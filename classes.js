//Log
//Singleton that logs information
//Log singleton
var Log = {
  elem: null,
  timer: null,

  getElem: function() {
    if (!this.elem) {
      return (this.elem = $('#log-message'));
    }
    return this.elem;
  },

  write: function(text, hide) {
    if (this.timer) {
      this.timer = clearTimeout(this.timer);
    }

    var elem = this.getElem(),
        style = elem.parent()[0].style;

    elem.innerHTML = text;
    style.display = '';

    if (hide) {
      this.timer = setTimeout(function() {
        style.display = 'none';
      }, 2000);
    }
  }
};

//RightMenu
var RightMenu = function(HypsterList, HypsterMgr) {
  var me = this;
  me.HypsterList = HypsterList;
  me.HypsterMgr = HypsterMgr;
  me.selectedHypsters = $('#selected-Hypsters');

  HypsterList.on('mousemove', function(e) { me.onMouseMove(e); }, false);
  HypsterList.on('mouseout', function(e) { me.onMouseOut(e); }, false);
  HypsterList.on('change', function(e) { me.onChange(e); }, false);

  me.selectedHypsters.on('click', function(e) { me.onClick(e); }, false);
  me.selectedHypsters.on('mousemove', function(e) { me.onHover(e); }, false);
  me.selectedHypsters.on('mouseout', function (e) { me.onLeave(e); }, false);
};

RightMenu.prototype = {
  append: function(html) {
    this.HypsterList.innerHTML += html;
  },

  onMouseMove: function(e) {
    var target = e.target,
        nodeName = target.nodeName;

    if (nodeName == 'INPUT') {
      target = target.parent()[0];
    }

    if (nodeName == 'LABEL') {
      target = target.parent()[0];
    }

    if (target.nodeName == 'LI') {
      var elem = target,
          prev = elem,
          next = elem.nextSibling,
          x = e.pageX,
          y = e.pageY,
          tol = 30,
          box, elemY, style, lerp;

      while (prev || next) {
        if (prev) {
          style = prev.style;
          box = prev.getBoundingClientRect();
          elemY = (box.top + box.bottom) / 2;
          lerp = (1 + Math.min(Math.abs(y - elemY), tol) / tol * -1);
          prev = prev.previousSibling;
          style.fontSize = (1 + (1.6 - 1) * lerp) + 'em';
        }
        if (next) {
          style = next.style;
          box = next.getBoundingClientRect();
          elemY = (box.top + box.bottom) / 2;
          lerp = (1 + Math.min(Math.abs(y - elemY), tol) / tol  * -1);
          next = next.nextSibling;
          style.fontSize = (1 + (1.6 - 1) * lerp) + 'em';
        }
      }
    }
  },

  onMouseOut: function(e) {
    var nodeName = e.relatedTarget && e.relatedTarget.nodeName;
    if (nodeName && 'INPUT|LI|LABEL'.indexOf(nodeName) == -1) {
      Array.prototype.slice.call(HypsterList.getElementsByTagName('li')).forEach(function(elem) {
        elem.style.fontSize = '1em';
      });
    }
  },

  onChange: function(e) {
    var checkbox = e.target,
        label = checkbox.parent()[0],
        HypsterId = checkbox.id.split('-')[1],
        name = label.textContent,
        HypsterMgr = this.HypsterMgr,
        color = HypsterMgr.getColor(HypsterId) || HypsterMgr.getAvailableColor();

    if (checkbox.checked) {
      this.selectedHypsters.innerHTML += '<li id=\'' + HypsterId + '-selected\'>' +
        '<input type=\'checkbox\' checked id=\'' + HypsterId + '-checkbox-selected\' />' +
        '<div class=\'square\' style=\'background-color:rgb(' + color + ');\' ></div>' +
        name + '</li>';
    } else {
      var node = $("#" + HypsterId + '-selected');
      node.parent()[0].removeChild(node);
    }
  },

  onClick: function(e) {
    var target = e.target, node;
    if (target.nodeName == 'INPUT') {
      var HypsterId = target.parent()[0].id.split('-')[0];
      var checkbox = $('#checkbox-' + HypsterId);
      checkbox.checked = false;
      HypsterMgr.remove(HypsterId);
      target = target.parent()[0];
      node = target.nextSibling || target.previousSibling;
      target.parent()[0].removeChild(target);
      if (node && node.id) {
        centerHypster(node.id.split('-')[0]);
      }
    } else {
      if (target.nodeName == 'DIV') {
        target = target.parent()[0];
      }
      centerHypster(target.id.split('-')[0]);
    }
  },

  onHover: function(e) {
    var target = e.target, HypsterId;
    if (target.nodeName == 'INPUT') {
      HypsterId = target.parent()[0].id.split('-')[0];
    } else {
      if (target.nodeName == 'DIV') {
        target = target.parent()[0];
      }
      HypsterId = target.id.split('-')[0];
    }
    for (var name in models.Hypsters) {
      models.Hypsters[name].lineWidth = name == HypsterId ? 2 : 1;
    }
  },

  onLeave: function(e) {
    var rt = e.relatedTarget,
        pn = rt && rt.parent()[0],
        pn2 = pn && pn.parent()[0];

    if (rt != this.selectedHypsters &&
        pn != this.selectedHypsters &&
       pn2 != this.selectedHypsters) {

      for (var name in models.Hypsters) {
        models.Hypsters[name].lineWidth = 1;
      }
    }
  }
};

//HypsterManager
//Takes care of adding and removing routes
//for the selected Hypsters
var HypsterManager = function(data, models) {

  var HypsterIdColor = {};

  var availableColors = {
    '4, 195, 165': 0,
	'255, 215, 0': 0,
    '254, 63, 0': 0,
    '236, 26, 109': 0,
    '103, 61, 159': 0,
  };


  var getAvailableColor = function() {
    var min = Infinity,
        res = false;
    for (var color in availableColors) {
      var count = availableColors[color];
      if (count < min) {
        min = count;
        res = color;
      }
    }
    return res;
  };


  return {

    HypsterIds: [],

    getColor: function(HypsterId) {
        return HypsterIdColor[HypsterId];
    },

    generateColor: function () {
      var color = getAvailableColor();
      availableColors[color]++;
      return color;
    },

    getAvailableColor: getAvailableColor,

    add: function(Hypster) {
      var HypsterIds = this.HypsterIds,
          color = data.colors[Hypster],
          Hypsters = models.Hypsters,
          model = Hypsters[Hypster],
          people = data.Hypsters[Hypster],
          samplings = 10,
          vertices = [],
          indices = [],
          fromTo = [],
          sample = [],
          parsedColor;

      parsedColor = color.split(',');
      parsedColor = [parsedColor[0] / (255 * 1.3),
                     parsedColor[1] / (255 * 1.3),
                     parsedColor[2] / (255 * 1.3)];


      if (model) {
        model.uniforms.color = parsedColor;
      } else {

        for (var i = 0, l = people.length; i < l; i++) {
          var person = people[i],
              route = {
                origin: {
                  lat: person["Lat 1"],
                  lon: person["Lon 1"],
                },
                destination: {
                  lat: person["Lat 2"],
                  lon: person["Lon 2"]
                }
              }
          var ans = this.createRoute(route, vertices.length / 3);
          vertices.push.apply(vertices, ans.vertices);
          fromTo.push.apply(fromTo, ans.fromTo);
          sample.push.apply(sample, ans.sample);
          indices.push.apply(indices, ans.indices);
        }

        Hypsters[Hypster] = model = new O3D.Model({
          vertices: vertices,
          indices: indices,
          program: 'Hypster_layer',
          uniforms: {
            color: parsedColor
          },
          render: function(gl, program, camera) {
              gl.lineWidth(this.lineWidth || 1);
              gl.drawElements(gl.LINES, this.$indicesLength, gl.UNSIGNED_SHORT, 0);
          },
          attributes: {
            fromTo: {
              size: 4,
              value: new Float32Array(fromTo)
            },
            sample: {
              size: 1,
              value: new Float32Array(sample)
            }
          }
        });

        model.fx = new Fx({
          transition: Fx.Transition.Quart.easeOut
        });
      }

      this.show(model);

      HypsterIds.push(Hypster);
      //set color for Hypster Id
      //availableColors[color]++;
      HypsterIdColor[Hypster] = color;
    },

    remove: function(Hypster) {
      var Hypsters = models.Hypsters,
          model = Hypsters[Hypster],
          color = HypsterIdColor[Hypster];

      this.hide(model);

      //unset color for Hypster Id.
      //availableColors[color]--;
      delete HypsterIdColor[Hypster];
    },

    show: function(model) {
      model.uniforms.animate = true;
      this.app.scene.add(model);
      model.fx.start({
        delay: 0,
        duration: 2000,
        onCompute: function(delta) {
          model.uniforms.delta = delta;
        },
        onComplete: function() {
          model.uniforms.animate = false;
        }
      });
    },

    hide: function(model) {
      var me = this;
      model.uniforms.animate = true;
      model.fx.start({
        delay: 0,
        duration: 1200,
        onCompute: function(delta) {
          model.uniforms.delta = (1 - delta);
        },
        onComplete: function() {
          model.uniforms.animate = false;
          me.app.scene.remove(model);
        }
      });
    },

    getCoordinates: function(from, to) {
      var pi = Math.PI,
          pi2 = pi * 2,
          sin = Math.sin,
          cos = Math.cos,
          theta = pi2 - (+to + 180) / 360 * pi2,
          phi = pi - (+from + 90) / 180 * pi,
          sinTheta = sin(theta),
          cosTheta = cos(theta),
          sinPhi = sin(phi),
          cosPhi = cos(phi),
          p = new Vec3(cosTheta * sinPhi, cosPhi, sinTheta * sinPhi);

      return {
        theta: theta,
        phi: phi,
        p: p
      };
    },

    //creates a quadratic bezier curve as a route
    createRoute: function(route, offset) {

      var c1 = this.getCoordinates(route.origin.lat, route.origin.lon),
          c2 = this.getCoordinates(route.destination.lat, route.destination.lon),
          p1 = c1.p,
          p2 = c2.p,
          p3 = p2.add(p1).$scale(0.5).$unit().$scale(p1.distTo(p2) / 2 + 1.2),
          theta1 = c1.theta,
          theta2 = c2.theta,
          phi1 = c1.phi,
          phi2 = c2.phi,
          pArray = [],
          pIndices = [],
          fromTo = [],
          sample = [],
          t = 0,
          count = 0,
          samplings = 10,
          deltat = 1 / samplings;

      for (var i = 0; i <= samplings; i++) {
        pArray.push(p3[0], p3[1], p3[2]);
        fromTo.push(theta1, phi1, theta2, phi2);
        sample.push(i);

        if (i !== 0) {
          pIndices.push(i -1, i);
        }
      }

      return {
        vertices: pArray,
        fromTo: fromTo,
        sample: sample,
        indices: pIndices.map(function(i) { return i + offset; }),
        p1: p1,
        p2: p2
      };
    }
  };

};
