d3.sankeyBasic = function() {
    this._nodeWidth = 24;
    this._nodePadding = 8;
    this._size = [1, 1];
    this._nodes = [];
    this._nodesByBreadth = [];
    this._links = [];
}

d3.sankeyBasic.prototype.nodeWidth = function(_) {
    if (!arguments.length) return this._nodeWidth;
    this._nodeWidth = +_;
    return this;
};

d3.sankeyBasic.prototype.nodePadding = function(_) {
    if (!arguments.length) return this._nodePadding;
    this._nodePadding = +_;
    return this;
};

d3.sankeyBasic.prototype.nodes = function(_) {
    if (!arguments.length) return this._nodes;
    this._nodes = _;
    return this;
};

d3.sankeyBasic.prototype.nodesByBreadth = function(_) {
  if (!arguments.length) return this._nodesByBreadth;
  this._nodesByBreadth = _;
  return this;
};

d3.sankeyBasic.prototype.links = function(_) {
    if (!arguments.length) return this._links;
    this._links = _;
    return this;
};

d3.sankeyBasic.prototype.size = function(_) {
    if (!arguments.length) return this._size;
    this._size = _;
    return this;
};

d3.sankeyBasic.prototype.layout = function() {
    this.computeNodeLinks();
    this.computeNodeValues();
    this.computeNodeBreadths();
    this.computeNodeDepths();
    this.setNodePositions();
    this.computeLinkDepths();

    return this;
};

d3.sankeyBasic.prototype.relayout = function () {
    this.computeLinkDepths();
    return this;
};

d3.sankeyBasic.prototype.link = function() {
    var curvature = .5;

    function link(d) {
        var x0 = d.source.x + d.source.dx,
            x1 = d.target.x,
            xi = d3.interpolateNumber(x0, x1),
            x2 = xi(curvature),
            x3 = xi(1 - curvature),
            y0 = d.source.y + d.sy + d.dy / 2,
            y1 = d.target.y + d.ty + d.dy / 2;
        return "M" + x0 + "," + y0
            + "C" + x2 + "," + y0
            + " " + x3 + "," + y1
            + " " + x1 + "," + y1;
    }

    link.curvature = function (_) {
        if (!arguments.length) return curvature;
        curvature = +_;
        return link;
    };

    return link;
};

// Populate the sourceLinks and targetLinks for each node.
// Also, if the source and target are not objects, assume they are indices.
d3.sankeyBasic.prototype.computeNodeLinks = function() {
    this._nodes.forEach(function(node) {
        node.sourceLinks = [];
        node.targetLinks = [];
    });
    this._links.forEach(function(link) {
        var source = link.source,
            target = link.target;
        if (typeof source === "number") source = link.source = this._nodes[link.source];
        if (typeof target === "number") target = link.target = this._nodes[link.target];
        source.sourceLinks.push(link);
        target.targetLinks.push(link);
    }, this);
}

// Compute the value (size) of each node by summing the associated links.
d3.sankeyBasic.prototype.computeNodeValues = function() {
    this._nodes.forEach(function (node) {
        node.value = Math.max(
            d3.sum(node.sourceLinks, value),
            d3.sum(node.targetLinks, value)
        );
    });
}

// Iteratively assign the breadth (x-position) for each node.
// Nodes are assigned the maximum breadth of incoming neighbors plus one;
// nodes with no incoming links are assigned breadth zero, while
// nodes with no outgoing links are assigned the maximum breadth.
d3.sankeyBasic.prototype.computeNodeBreadths = function() {
    var remainingNodes = this._nodes,
        nextNodes,
        x = 0;

    while (remainingNodes.length) {
        nextNodes = [];
        remainingNodes.forEach(function (node) {
            node.x = x;
            node.dx = this._nodeWidth;
            node.sourceLinks.forEach(function (link) {
                if (nextNodes.indexOf(link.target) < 0) {
                    nextNodes.push(link.target);
                }
            });
        }, this);
        remainingNodes = nextNodes;
        ++x;
    }

    //
    this.moveSinksRight(x);
    this.scaleNodeBreadths((this._size[0] - this._nodeWidth) / (x - 1));
    this.nodesByBreadth(this.groupByBreadths());
}

d3.sankeyBasic.prototype.moveSinksRight = function(x) {
    this._nodes.forEach(function (node) {
        if (!node.sourceLinks.length) {
            node.x = x - 1;
        }
    });
}

d3.sankeyBasic.prototype.scaleNodeBreadths = function(kx) {
    this._nodes.forEach(function (node) {
        node.x *= kx;
    });
}

d3.sankeyBasic.prototype.groupByBreadths = function() {
    var nodesByBreadth = d3.nest()
        .key(function (d) {
            return d.x;
        })
        .sortKeys(d3.ascending)
        .entries(this._nodes)
        .map(function (d) {
            return d.values;
        });

    return nodesByBreadth;
};

d3.sankeyBasic.prototype.computeNodeDepths = function() {
    var size = this._size[1];
    var np = this._nodePadding;
    var ky = d3.min(this._nodesByBreadth, function (nodes) {
        return (size - (nodes.length - 1) * 1.1* np) / d3.sum(nodes, value);
    });

    this.initializeNodeDepth(ky);
};

d3.sankeyBasic.prototype.initializeNodeDepth = function(ky) {
    // node.y sets y-position of top of each node at a given x-location.
    this._nodesByBreadth.forEach(function (nodes) {
        nodes.forEach(function (node, i) {
            node.y = i;
            node.dy = node.value * ky;
        });
    });

    this._links.forEach(function (link) {
        link.dy = link.value * ky;
    });
}

d3.sankeyBasic.prototype.setNodePositions = function() {
    this._nodesByBreadth.forEach(function (nodes) {
        var node,
            dy,
            y0 = 0,
            n = nodes.length,
            i;

        // Push any overlapping nodes down.
        nodes.sort(ascendingDepth);
        for (i = 0; i < n; ++i) {
            node = nodes[i];
            dy = y0 - node.y;
            if (dy > 0) node.y += dy;
            y0 = node.y + node.dy + this._nodePadding;
        }

        // Center nodes vertically
        let offset = (this._size[1] - (y0 - this._nodePadding)) / 2;
        for (i = 0; i < n; ++i) {
            node = nodes[i];
            node.y += offset;
        }
    }, this)
}

d3.sankeyBasic.prototype.computeLinkDepths = function() {
    this._nodes.forEach(function (node) {
        node.sourceLinks.sort(ascendingTargetDepth);
        node.targetLinks.sort(ascendingSourceDepth);
    });
    this._nodes.forEach(function (node) {
        var sy = 0, ty = 0;
        node.sourceLinks.forEach(function (link) {
            link.sy = sy;
            sy += link.dy;
        });
        node.targetLinks.forEach(function (link) {
            link.ty = ty;
            ty += link.dy;
        });
    });

    function ascendingSourceDepth(a, b) {
        return a.source.y - b.source.y;
    }

    function ascendingTargetDepth(a, b) {
        return a.target.y - b.target.y;
    }
}

function ascendingDepth(a, b) {
    return a.y - b.y;
}

function center(node) {
    return node.y + node.dy / 2;
}

function value(link) {
    return link.value;
}

d3.sankeyOptimized = function() {
    d3.sankeyBasic.call(this)
    this._iterations = 32;
}
d3.sankeyOptimized.prototype = Object.create(d3.sankeyBasic.prototype);

d3.sankeyOptimized.prototype.iterations = function(_) {
    if (!arguments.length) return this._iterations;
    this._iterations = _;
    return this;
};

d3.sankeyOptimized.prototype.setNodePositions = function() {
    this.resolveCollisions()
    let iterations = this._iterations;
    for (var alpha = 1; iterations > 0; --iterations) {
        this.relaxRightToLeft(alpha *= .99);
        this.resolveCollisions();
        this.relaxLeftToRight(alpha);
        this.resolveCollisions();
    }
}

d3.sankeyOptimized.prototype.resolveCollisions = function() {
    this._nodesByBreadth.forEach(function (nodes) {
        var node,
            dy,
            y0 = 0,
            n = nodes.length,
            i;

        // Push any overlapping nodes down.
        nodes.sort(ascendingDepth);
        for (i = 0; i < n; ++i) {
            node = nodes[i];
            dy = y0 - node.y;
            if (dy > 0) node.y += dy;
            y0 = node.y + node.dy + this._nodePadding;
        }

        // If the bottommost node goes outside the bounds, push it back up.
        dy = y0 - this._nodePadding - this._size[1];
        if (dy > 0) {
            y0 = node.y -= dy;

            // Push any overlapping nodes back up.
            for (i = n - 2; i >= 0; --i) {
                node = nodes[i];
                dy = node.y + node.dy + this._nodePadding - y0;
                if (dy > 0) node.y -= dy;
                y0 = node.y;
            }
        }
    }, this);
}

d3.sankeyOptimized.prototype.relaxLeftToRight = function(alpha) {
    this._nodesByBreadth.forEach(function (nodes, breadth) {
        nodes.forEach(function (node) {
            if (node.targetLinks.length) {
                var y = d3.sum(node.targetLinks, weightedSource) / d3.sum(node.targetLinks, value);
                node.y += (y - center(node)) * alpha;
            }
        });
    }, this);

    function weightedSource(link) {
        return center(link.source) * link.value;
    }
}

d3.sankeyOptimized.prototype.relaxRightToLeft = function(alpha) {
    this._nodesByBreadth.slice().reverse().forEach(function (nodes) {
        nodes.forEach(function (node) {
            if (node.sourceLinks.length) {
                var y = d3.sum(node.sourceLinks, weightedTarget) / d3.sum(node.sourceLinks, value);
                node.y += (y - center(node)) * alpha;
            }
        });
    }, this);

    function weightedTarget(link) {
        return center(link.target) * link.value;
    }
}

d3.sankeyChart = function (data, options) {

    var self = this;

    self.chartType = options.chartConfig && options.chartConfig.type ?
        options.chartConfig.type : d3.sankeyBasic;
    self.typeSettings = options.chartConfig && options.chartConfig.settings ?
        options.chartConfig.settings : {};

    self.nodeWidth = options.node && options.node.width ? options.node.width : 15;
    self.nodePadding = options.node && options.node.padding ? options.node.padding : 10;

    self.margin = options.margin;
    self.width = options.width;
    self.height = options.height;
    self.innerWidth = options.width - self.margin.left - self.margin.right;
    self.innerHeight = options.height - self.margin.top - self.margin.bottom;
    self.bgColor = options.background ? options.background : 'white';
    self.dynamicLinkColor = options.dynamicLinkColor ? options.dynamicLinkColor : false;
    self.staticLinkColor = options.staticLinkColor ? options.staticLinkColor : '#000';
    self.onNodeClick = options.onNodeClick ? options.onNodeClick : null;
    self.getNodeColor = options.getNodeColor ? options.getNodeColor : d => {
                d.color = self.color(d.name.replace(/ .*/, ''));
                return d.color;
            };
    self.getLinkColor = options.getLinkColor ? options.getLinkColor : d => {
                d.color = self.color(d.source.name.replace(/ .*/, ''));
                return d.color;
            };
    var valueFormat = options.value && options.value.format ? options.value.format : ',.0f';
    self.formatNumber = d3.format(valueFormat);
    var valueUnit = options.value && options.value.unit ? options.value.unit : '';
    self.format = d => `${self.formatNumber(d)}` + valueUnit;
    self.nodeText = d => d.name;
    if (options.node && options.node.showValue) {
        self.nodeText = d => d.name + ' : ' + self.format(d.value);
    }
    self.color = d3.scale.category20();

    let canvas, svg, sankey, link, path, node = null;

    self.initContainers = function () {
        canvas = d3.select(options.chart + ' canvas')
            .attr('width', self.width)
            .attr('height', self.height)
            .style('position', 'absolute');

        svg = d3.select(options.chart + ' svg')
            .style('position', 'absolute')
            .attr('width', self.width)
            .attr('height', self.height)
            .append('g')
            .attr('transform', `translate(${self.margin.left}, ${self.margin.top})`);

        svg.append('rect')
            .attr('width', self.width)
            .attr('height', self.height)
            .attr("fill", self.bgColor)
            .call(d3.behavior.zoom().scaleExtent([1, 8]).on("zoom", zoom));
    };
    self.initCore = function () {
        sankey = new self.chartType()
            .nodeWidth(self.nodeWidth)
            .nodePadding(self.nodePadding)
            .size([self.innerWidth, self.innerHeight]);

        // Apply settings specific to this chart type
        for (var paramSetter in self.typeSettings) {
            let paramValue = self.typeSettings[paramSetter];
            sankey[paramSetter](paramValue)
        }

        sankey
            .nodes(data.nodes)
            .links(data.links)
            .layout();
    };

    self.renderLinks = function () {
        path = sankey.link();
        link = svg.append('g').selectAll('.link')
            .data(data.links)
            .enter().append('path')
            .attr('class', 'link')
            .attr('d', path)
            .style('stroke-width', d => Math.max(1, d.dy))
            .style({
                fill: 'none',
                'stroke-opacity': 0.15
            })
            .style('stroke', function (d) {
                let color = self.staticLinkColor ? self.staticLinkColor : '#000';
                color = self.dynamicLinkColor ? self.getLinkColor(d) : color;

                return color;
            })
            .sort((a, b) => b.dy - a.dy);

        link
            .on('mouseover', function () {
                d3.select(this)
                    .style('stroke-opacity', 0.25);
            })
            .on('mouseout', function () {
                d3.select(this)
                    .style('stroke-opacity', 0.15);
            });

        link.append('title')
            .text(d => `${d.source.name} → ${d.target.name}\n${self.format(d.value)}`);
    };

    self.renderNodes = function () {
        node = svg.append('g').selectAll('.node')
            .data(data.nodes)
            .enter().append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${d.x}, ${d.y})`)
            .on('click', function(d) {
                if (!self.onNodeClick || d3.event.defaultPrevented) {
                    return
                };

                self.onNodeClick(d);
            })
            .call(d3.behavior.drag()
                .origin(d => d)
                .on('drag', dragmove));

        node.append('rect')
            .attr('height', d => d.dy)
            .attr('width', sankey.nodeWidth())
            .style('fill', d => self.getNodeColor(d))
            .style({
                stroke: 'none',
                cursor: 'move',
                'fill-opacity': 0.9,
                'shape-rendering': 'crispEdges'
            })
            .append('title')
            .text(d => `${d.name}\n${self.format(d.value)}`);

        node.append('text')
            .attr('x', -6)
            .attr('y', d => d.dy / 2)
            .attr('dy', '.35em')
            .attr('text-anchor', 'end')
            .attr('transform', null)
            .style({
                'pointer-events': 'none',
                'text-shadow': '0 1px 0 #fff'
            })
            .text(d => self.nodeText(d))
            .filter(d => d.x < self.innerWidth / 2)
            .attr('x', 6 + sankey.nodeWidth())
            .attr('text-anchor', 'start');
    };

    self.initContainers();
    self.initCore();
    self.renderLinks();
    self.renderNodes();

    function dragmove(d) {
        this.parentNode.appendChild(this);
        d3.select(this)
            .attr('transform', `translate(${d.x}, ${(d.y = Math.max(0, Math.min(self.innerHeight - d.dy, d3.event.y)))})`);
        sankey.relayout();
        link.attr('d', path);
    }

    function zoom(d) {
        svg
          .attr("transform",
          "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
    }

}
