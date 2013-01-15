//Unpack modules
PhiloGL.unpack();
Scene.PICKING_RES = 1;

//some locals
var $$ = function(selector) { return document.querySelectorAll(selector); },
    citiesWorker = new Worker('cities.js'),
    data = { citiesRoutes: {}, Hypsters: {}, colors: {} },
    models = { Hypsters: {} }, geom = {},
    hypsterMgr = new HypsterManager(data, models),
    fx = new Fx({
      duration: 1000,
      transition: Fx.Transition.Expo.easeInOut
    }),
    HypsterList, pos, tooltip, rightMenu;

$(document).ready(function(){
    if (PhiloGL.hasWebGL()) {
      HypsterList = $('#Hypster-list');
      tooltip = $('#tooltip')[0];

      // Create the right menu
      //rightMenu = new RightMenu(HypsterList, hypsterMgr);

      //load dataset
      loadData();
      // Uncomment if you want the scrollbars to lock when you're zooming
     $('#canvas-wrapper').on('mouseenter', function() {
     $('body').addClass('stop-scrolling');
     });

     $('#canvas-wrapper').on('mouseleave', function() {
     $('body').removeClass('stop-scrolling');
     });
    }
});

//Create earth
models.earth = new O3D.Sphere({
  nlat: 150,
  nlong: 150,
  radius: 1,
  uniforms: {
    shininess: 32
  },
  textures: ['img/earth2.jpg'],
  program: 'earth'
});
models.earth.rotation.set(Math.PI, 0,  0);
models.earth.update();

//Create cities layer model and create PhiloGL app.
citiesWorker.onmessage = function(e) {
  var modelInfo = e.data;

  if (typeof modelInfo == 'number') {
      Log.write('Building models ' + modelInfo + '%');
  } else {
    data.citiesIndex = modelInfo.citiesIndex;
    models.cities = new O3D.Model(Object.create(modelInfo, {
      pickable: {
        value: true
      },
      //Add a custom picking method
      pick: {
        value: function(pixel) {
          //calculates the element index in the array by hashing the color values
          if (pixel[0] == 0 && (pixel[1] != 0 || pixel[2] != 0)) {
            var index = pixel[2] + pixel[1] * 256;
            return index;
          }
          return false;
        }
      },

      render: {
        value: function(gl, program, camera) {
          gl.drawElements(gl.TRIANGLES, this.$indicesLength, gl.UNSIGNED_SHORT, 0);
        }
      }
    }));
    Log.write('Loading assets...');
    createApp();
  }
};

citiesWorker.onerror = function(e) {
  Log.write(e);
};

function loadData() {
  Log.write('Loading Hyper data...');
  //Request cities data
  new IO.XHR({
    url: 'data/cities.json',
    onSuccess: function(json) {
      data.cities = JSON.parse(json);
      citiesWorker.postMessage(data.cities);
      Log.write('Building models...');
    },
    onProgress: function(e) {
      Log.write('Loading Hyper data, sit down and relax...' +
                (e.total ? Math.round(e.loaded / e.total * 1000) / 10 : ''));
    },
    onError: function() {
      Log.write('There was an error while fetching the Hyper data.', true);
    }
  }).send();
  loadPeople('Hyper Students');
  loadPeople('Hyper Collaborators');
  loadPeople('Hyper Alumni');
  loadPeople('Hyper Coworkers');
  loadPeople('Hyper Nationalities');



  // Highlight the arcs when you hover on them
  HypsterList.find('label').live('hover', function(e) {
    var type = $(this).attr('for').split('-')[1];
    for (var name in models.Hypsters) {
      models.Hypsters[name].lineWidth = name == type ? 2 : 1;
    }
  });

  //when an Hypster is selected show all paths for that Hypster
  HypsterList.live('change', function(e) {
    var target = e.target,
        type = target.id.split("-")[1];

    //debugger
    if (!$(target).parent().parent().find('ul').length) {
      if (target.checked) {
        hypsterMgr.add(type);
        centerHypster("greece^athens");

      } else {
        hypsterMgr.remove(type);
      }
    }
  });

}

function loadPeople(type) {
  HypsterList.append('<li id="filter-' + type.replace(" ", "-") + '"></li>' );
  var color = data.colors[type] = hypsterMgr.generateColor();
  var filename = type.toLowerCase().replace(" ", "_");

  //Request Hypster data
  new IO.XHR({
    url: 'data/' + filename + '.json',
    onSuccess: function(json) {
      var json = JSON.parse(json),
        categories = {},
        multipleCategories = false;

      for (var i = 0, l = json.length; i < l; i++) {
        var person = json[i],
            category = type;
        if (person.course) {
          multipleCategories = true;
          category = type + "::" + person.course;
        }
        if (person.program) {
          multipleCategories = true;
          category = type + "::" + person.program;
        }

        if (!categories[category]) {
          categories[category] = [];
          data.Hypsters[category] = {}
        }
        categories[category].push(person);



      }


      // Generate the filter list on the right! Najs!
      html = ('<label for=\'checkbox-' +
        type + '\'><input type=\'checkbox\' id=\'checkbox-' +
        type + '\' /> ' + type + '</label>' +
        '<div class=\'square\' style=\'background-color:rgb(' + color + ');\' ></div>');
      data.Hypsters[type] = categories[type];

      if (multipleCategories) {
        var categoryHTML = [];
        for (var category in categories) {
          data.Hypsters[category] = categories[category];
          data.colors[category] = color;
          if (category != type) {
            var name = category.split("::")[1]
            categoryHTML.push('<li><label for=\'checkbox-' +
            category + '\'><input type=\'checkbox\' id=\'checkbox-' +
            category + '\' /> ' + name + '</label></li>');
          }
        }
        html += '<ul class="subfilter">' + categoryHTML.join('') + '</ul>';
      }
      HypsterList.find("#filter-" + type.replace(" ", "-")).append(html);

      if (multipleCategories) {
        // Hide all subfilters at the start
        HypsterList.find("ul:last").slideUp();
        // Handler for clicking on filters
        HypsterList.find("ul:last").each(function(e){
          var _this = $(this);
          var parent = _this.parent();
          parent.find('input[type=checkbox]:first').change(function(e) {
            if (this.checked) {
              _this.slideDown();
              _this.find("input[type=checkbox]").each(function(e){
                if (!this.checked) {
                  this.click();
                }
              });
            } else {
              _this.slideUp();
              _this.find("input[type=checkbox]").each(function(e){
                if (this.checked) {
                  this.click();
                }
              });
            }
          });
        });
      };


    },
    onError: function() {
      Log.write('There was an error while fetching the Hyper data.', true);
    }
  }).send();
}

//center the airline
function centerHypster(city) {
  var city = data.cities[city],
      pi = Math.PI,
      pi2 = pi * 2,
      phi = pi - (+city[2] + 90) / 180 * pi,
      theta = pi2 - (+city[3] + 180) / 360 * pi2;

  var earth = models.earth,
      cities = models.cities,
      phiPrev = geom.phi || Math.PI / 2,
      thetaPrev = geom.theta || (3 * Math.PI / 2),
      phiDiff = phi - phiPrev,
      thetaDiff = theta - thetaPrev;

  geom.matEarth = earth.matrix.clone();
  geom.matCities = cities.matrix.clone();

  fx.start({
    onCompute: function(delta) {
      rotateXY(phiDiff * delta, thetaDiff * delta);
      geom.phi = phiPrev + phiDiff * delta;
      geom.theta = thetaPrev + thetaDiff * delta;
    },

    onComplete: function() {
      centerHypster.app.scene.resetPicking();
    }
  });
}
//rotate the globe of phi and theta angles
function rotateXY(phi, theta) {
  var earth = models.earth,
      cities = models.cities,
      Hypsters = models.Hypsters,
      xVec = [1, 0, 0],
      yVec = [0, 1, 0],
      yVec2 =[0, -1, 0];

  earth.matrix = geom.matEarth.clone();
  cities.matrix = geom.matCities.clone();

  var m1 = new Mat4(),
      m2 = new Mat4();

  m1.$rotateAxis(phi, xVec);
  m2.$rotateAxis(phi, xVec);

  m1.$mulMat4(earth.matrix);
  m2.$mulMat4(cities.matrix);

  var m3 = new Mat4(),
      m4 = new Mat4();

  m3.$rotateAxis(theta, yVec2);
  m4.$rotateAxis(theta, yVec);

  m1.$mulMat4(m3);
  m2.$mulMat4(m4);

  earth.matrix = m1;
  cities.matrix = m2;
  for (var name in Hypsters) {
    Hypsters[name].matrix = m2;
  }
}

function createApp() {
  //Create application
  PhiloGL('map-canvas', {
    program: [{
      //to render cities and routes
      id: 'Hypster_layer',
      from: 'uris',
      path: 'shaders/',
      vs: 'hypster_layer.vs.glsl',
      fs: 'hypster_layer.fs.glsl',
      noCache: true
    }, {
      //to render cities and routes
      id: 'layer',
      from: 'uris',
      path: 'shaders/',
      vs: 'layer.vs.glsl',
      fs: 'layer.fs.glsl',
      noCache: true
    },{
      //to render the globe
      id: 'earth',
      from: 'uris',
      path: 'shaders/',
      vs: 'earth.vs.glsl',
      fs: 'earth.fs.glsl',
      noCache: true
    }, {
      //for glow post-processing
      id: 'glow',
      from: 'uris',
      path: 'shaders/',
      vs: 'glow.vs.glsl',
      fs: 'glow.fs.glsl',
      noCache: true
    }],
    camera: {
      position: {
        x: 0, y: 0, z: -5.125
      }
    },
    scene: {
      lights: {
        enable: true,
        ambient: {
          r: 0.4,
          g: 0.4,
          b: 0.4
        },
        points: {
          diffuse: {
            r: 0.8,
            g: 0.8,
            b: 0.8
          },
          specular: {
            r: 0.9,
            g: 0.9,
            b: 0.9
          },
          position: {
            x: 2,
            y: 2,
            z: -4
          }
        }
      }
    },
    events: {
      picking: true,
      centerOrigin: false,
      onDragStart: function(e) {
        pos = pos || {};
        pos.x = e.x;
        pos.y = e.y;
        pos.started = true;

        geom.matEarth = models.earth.matrix.clone();
        geom.matCities = models.cities.matrix.clone();
      },
      onDragMove: function(e) {
        var phi = geom.phi,
            theta = geom.theta,
            clamp = function(val, min, max) {
                return Math.max(Math.min(val, max), min);
            },
            y = -(e.y - pos.y) / 100,
            x = (e.x - pos.x) / 100;

        rotateXY(y, x);

      },
      onDragEnd: function(e) {
        var y = -(e.y - pos.y) / 100,
            x = (e.x - pos.x) / 100,
            newPhi = (geom.phi + y) % Math.PI,
            newTheta = (geom.theta + x) % (Math.PI * 2);

        newPhi = newPhi < 0 ? (Math.PI + newPhi) : newPhi;
        newTheta = newTheta < 0 ? (Math.PI * 2 + newTheta) : newTheta;

        geom.phi = newPhi;
        geom.theta = newTheta;

        pos.started = false;

        this.scene.resetPicking();
      },
      onMouseWheel: function(e) {
        var camera = this.camera,
            from = -5.125,
            to = -2.95,
            pos = camera.position,
            pz = pos.z,
            speed = (1 - Math.abs((pz - from) / (to - from) * 2 - 1)) / 6 + 0.001;

        pos.z += e.wheel * speed;

        if (pos.z > to) {
            pos.z = to;
        } else if (pos.z < from) {
            pos.z = from;
        }

        clearTimeout(this.resetTimer);
        this.resetTimer = setTimeout(function(me) {
          me.scene.resetPicking();
        }, 500, this);

        camera.update();
      },
      onMouseEnter: function(e, model) {
        if (model) {
          clearTimeout(this.timer);
          var style = tooltip.style,
              name = data.citiesIndex[model.$pickingIndex].split('^'),
              textName = name[1][0].toUpperCase() + name[1].slice(1) + ', ' + name[0][0].toUpperCase() + name[0].slice(1),
              bbox = this.canvas.getBoundingClientRect();
          style.top = (e.y + 10 + bbox.top) + 'px';
          style.left = (e.x + 5 + bbox.left) + 'px';
          this.tooltip.className = 'tooltip show';

          this.tooltip.innerHTML = textName;
        }
      },
      onMouseLeave: function(e, model) {
        this.timer = setTimeout(function(me) {
          me.tooltip.className = 'tooltip hide';
        }, 500, this);
      },
      onWindowResize: function(e) {
        this.app.camera.aspect = window.innerWidth / window.innerHeight;
        this.app.camera.update();
      }
    },
    textures: {
      src: ['img/earth2.jpg']
    },
    onError: function() {
      Log.write("There was an error creating the app.", true);
    },
    onLoad: function(app) {
      Log.write('Done.', true);

      //Unpack app properties
      var gl = app.gl,
          scene = app.scene,
          camera = app.camera,
          canvas = app.canvas,
          width = canvas.width,
          height = canvas.height,
          program = app.program,
          clearOpt = gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT;

      app.tooltip = $('#tooltip')[0];
      //nasty
      window.app = app;
      centerHypster.app = app;
      hypsterMgr.app = app;

      gl.clearColor(0, 0, 0, 1);
      gl.clearDepth(1);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);

      //create shadow, glow and image framebuffers
      app.setFrameBuffer('world', {
        width: 1024,
        height: 1024,
        bindToTexture: {
          parameters : [ {
            name : 'TEXTURE_MAG_FILTER',
            value : 'LINEAR'
          }, {
            name : 'TEXTURE_MIN_FILTER',
            value : 'LINEAR',
            generateMipmap : false
          } ]
        },
        bindToRenderBuffer: true
      }).setFrameBuffer('world2', {
        width: 1024,
        height: 1024,
        bindToTexture: {
          parameters : [ {
            name : 'TEXTURE_MAG_FILTER',
            value : 'LINEAR'
          }, {
            name : 'TEXTURE_MIN_FILTER',
            value : 'LINEAR',
            generateMipmap : false
          } ]
        },
        bindToRenderBuffer: true
      });

      //picking scene
      scene.add(models.earth,
                models.cities);

      draw();

      //window.addEventListener('resize', this.events.onWindowResize, false);

      //Select first Hypster
     // $$('#Hypster-list li input')[0].click();
      var timeout = setInterval(function(){
        var input = $('#filter-Hyper-Students input[type=checkbox]:first')
        if (input) {
          input.click();
          clearInterval(timeout);
        }
      }, 100);
      $('#list-wrapper')[0].style.display = '';

      //Draw to screen
      function draw() {
        // render to a texture
        gl.viewport(0, 0, 1024, 1024);

        program.earth.use();
        program.earth.setUniform('renderType',  0);
        app.setFrameBuffer('world', true);
        gl.clear(clearOpt);
        scene.renderToTexture('world');
        app.setFrameBuffer('world', false);

        program.earth.use();
        program.earth.setUniform('renderType',  -1);
        app.setFrameBuffer('world2', true);
        gl.clear(clearOpt);
        scene.renderToTexture('world2');
        app.setFrameBuffer('world2', false);

        Media.Image.postProcess({
          fromTexture: ['world-texture', 'world2-texture'],
          toScreen: true,
          program: 'glow',
          width: 1024,
          height: 1024
        });

        Fx.requestAnimationFrame(draw);
      }
    }
  });
}


