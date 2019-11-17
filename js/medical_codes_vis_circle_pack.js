

// ==================================== D3 ========================================


var svg = d3.select("svg");

var margin = 20,
    diameter = +svg.attr("width"),
    g = svg.append("g").attr("transform", "translate(" + diameter / 2 + "," + diameter / 2 + ")"),
    width = 800,
    height = 600;


var pack = d3.pack()
    .size([width, height - 50])
    .padding(10);

var tooltip = d3.select("body")
    .append("div")
    .style("position", "absolute")
    .style("z-index", "10")
    .style("visibility", "hidden")
    .style("background-color", "white")
    .style("border", "solid")
    .style("border-width", "2px")
    .style("border-radius", "5px").style("padding", "4px");


d3.json("data/icd10_full.json", function (error, root) {
    if (error) throw error;

    // Get maximal depth of the tree, to determine opacities of nodes.
    function getDepth(obj) {
        var depth = 0;
        if (obj.children) {
            obj.children.forEach(function (d) {
                var tmpDepth = getDepth(d);
                if (tmpDepth > depth) {
                    depth = tmpDepth
                }
            })
        }
        return 1 + depth
    }

    maxDepth = getDepth(root);
    console.log("max depth: " + maxDepth);

    let color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, root.children.length + 2));

    root = d3.hierarchy(root)
        .sum(function (d) {
            return d.value;
        })
        .sort(function (a, b) {
            return b.value - a.value;
        });

    var focus = root,
        nodes = pack(root).descendants(),
        view;

    var circle = g.selectAll("circle")
        .data(nodes)
        .enter().append("circle")
        .attr("class", function (d) {
            return d.parent ? d.children ? "node" : "node node--leaf" : "node node--root";
        })
        .style("fill", function (d) {
            if (d.depth === 0) {
                return color("root");
            }
            while (d.depth > 1) {
                d = d.parent;
            }
            return color(d.data.name);
        })
        .attr("fill-opacity", function (d) {
            return (d.depth + 1) / (maxDepth + 5);
        })
        // Initially, only display first two levels of hierarchy
        .style("display", d => d.depth < 2 ? "inline" : "none")
        .on("click", function (d) {
            if (focus !== d) zoom(d);
            d3.event.stopPropagation();
        })
        .on("mouseover", mouseover)
        .on("mousemove", mousemove)
        .on("mouseleave", mouseleave);

    var text = g.selectAll("text")
        .data(nodes)
        .enter().append("text")
        .attr("class", "circle-label")
        .style("font-size", function (d) {
            return (d.r/2.2).toString() + "px";
        })
        .style("fill-opacity", function (d) {
            return d.parent === root ? 1 : 0;
        })
        .style("display", function (d) {
            return d.parent === root ? "inline" : "none";
        })
        .text(function (d) {
            return d.data.name;
        });


    var node = g.selectAll("circle,text");

    svg.on("click", function () {
        zoom(root);
    });

    zoomTo([root.x, root.y, root.r * 2 + margin]);

    function zoom(d) {
        let targetDepth = d.depth;
        focus = d;
        if (!focus.children) {
            return;
        }

        var transition = d3.transition()
            .duration(d3.event.altKey ? 7500 : 750)
            .tween("zoom", function (d) {
                var i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2 + margin]);
                return function (t) {
                    zoomTo(i(t));
                };
            });

        transition.selectAll("circle")
            .filter(function (d) {
                return d.depth < targetDepth + 2 || this.style.display === "inline";
            })
            .style("fill-opacity", function (d) {
                return d.depth < targetDepth + 2 ? (d.depth + 1) / (maxDepth + 5) : 0;
            })
            .on("start", function (d) {
                // Only display the ancestors and children of focus (and the focus node).
                if (isAncestor(d, focus) || isChild(d, focus) || d === focus) {
                    this.style.display = "inline";
                }
            }).on("end", function (d) {
            // Hide non-ancestors and non-children
            if (!isAncestor(d, focus) && !isChild(d, focus) && d !== focus) {
                this.style.display = "none";
            }
        });

        transition.selectAll("text")
            .filter(function (d) {
                return d.parent === focus || this.style.display === "inline";
            })
            .style("fill-opacity", function (d) {
                return d.parent === focus ? 1 : 0;
            })
            .on("start", function (d) {
                if (d.parent === focus) {
                    let k = diameter / (focus.r * 2 + margin + 40);
                    this.style.fontSize = ((d.r/2.2) * k).toString() + "px";
                    this.style.display = "inline";
                }
            })
            .on("end", function (d) {
                if (d.parent !== focus) {
                    this.style.display = "none";
                }
            });
    }

    function zoomTo(v) {
        var k = diameter / v[2];
        view = v;
        node.attr("transform", function (d) {
            return "translate(" + (d.x - v[0]) * k + "," + (d.y - v[1]) * k + ")";
        });
        circle.attr("r", function (d) {
            return d.r * k;
        });
    }

    function isAncestor(potentialParent, node) {
        if (node.depth <= potentialParent.depth) {
            return false;
        }
        while (node.depth >= 0) {
            if (node.data.name === potentialParent.data.name) {
                return true;
            }
            if (node.parent != null) {
                node = node.parent;
            } else {
                return false;
            }
        }
        return false;
    }

    function isChild(potentialChild, node) {
        if (potentialChild.depth <= node.depth) {
            return false;
        }
        var child;
        for (child of node.children) {
            if (child.data.name === potentialChild.data.name) {
                return true;
            }
        }
        return false;
    }

    // Three function that change the tooltip when user hover / move / leave a cell
    function mouseover(d) {
        if (d.data.hasOwnProperty("description")) {
            tooltip.text((d.data.name + ": " + d.data.description)).style("visibility", "visible");
        }
    }

    function mousemove(d) {
        if (d.data.hasOwnProperty("description")) {
            tooltip.style("top", (event.pageY - 10) + "px").style("left", (event.pageX + 10) + "px");
        }
    }

    function mouseleave(d) {
        tooltip.style("visibility", "hidden");
    }

    // Get the total sum of a node
    function getTotalSum(obj) {
        if (obj.hasOwnProperty("value")) {
            return obj.value;
        }
        var tmpSum = 0;
        var c;
        for (c of obj.children) {
            tmpSum += getTotalSum(c);
        }
    }



    // ==================================== Input ========================================

    $(document).on('change', '.btn-file :file', function() {
        var input = $(this),
            numFiles = input.get(0).files ? input.get(0).files.length : 1,
            label = input.val().replace(/\\/g, '/').replace(/.*\//, '');
        // TODO: send the full file path to fileSelect, and change all values of the nodes
        input.trigger('fileselect', [numFiles, label]);
    });

    $(document).ready( function() {
        $('.btn-file :file').on('fileselect', function(event, numFiles, label) {

            var input = $(this).parents('.input-group').find(':text'),
                log = numFiles > 1 ? numFiles + ' files selected' : label;

            if( input.length ) {
                input.val(log);
            } else {
                if( log ) alert(log);
            }
        });
    });


});