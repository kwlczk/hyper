//Unpack modules
PhiloGL.unpack();
Scene.PICKING_RES = 1;

//some locals
var $ = function(id) { return document.getElementById(id); },
    $$ = function(selector) { return document.querySelectorAll(selector); },
    citiesWorker = new Worker('cities.js'),
    data = { citiesRoutes: {}, Hypsters: {} },
    models = { Hypsters: {} }, geom = {},
    hypsterMgr = new HypsterManager(data, models),
    fx = new Fx({
      duration: 1000,
      transition: Fx.Transition.Expo.easeInOut
    }),
    HypsterList, pos, tooltip, rightMenu;

//Get handles when document is ready
document.onreadystatechange = function() {
  if (document.readyState == 'complete' && PhiloGL.hasWebGL()) {

    HypsterList = $('Hypster-list');
    tooltip = $('tooltip');

    // Create the right menu
    rightMenu = new RightMenu(HypsterList, hypsterMgr);

    //Add search handler
    $('search').addEventListener('keyup', (function() {
      var timer = null,
          parentNode = HypsterList.parentNode,
          lis = HypsterList.getElementsByTagName('li'),
          previousText = '';

      function search(value) {
        parentNode.removeChild(HypsterList);
        for (var i = 0, l = lis.length; i < l; i++) {
          var li = lis[i],
              text = li.textContent || li.innerText;
          li.style.display = text.trim().toLowerCase().indexOf(value) > -1 ? '' : 'none';
        }
        parentNode.appendChild(HypsterList);
      }

      return function(e) {
        timer = clearTimeout(timer);
        var trimmed = this.value.trim();
        if (trimmed != previousText) {
          timer = setTimeout(function() {
            search(trimmed.toLowerCase());
            previousText = trimmed;
          }, 100);
        }
      };

    })(), true);

    //load dataset
    loadData();
  }
};

//Create earth
models.earth = new O3D.Sphere({
  nlat: 150,
  nlong: 150,
  radius: 1,
  uniforms: {
    shininess: 32
  },
  textures: ['img/earth.jpg'],
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
  Log.write('Loading data...');
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
  loadPeople('Hyperstudents');
  loadPeople('Collaborators');
  loadPeople('Alumni');
  loadPeople('Coworkers');
  loadPeople('Hyperscomefrom');

  //when an Hypster is selected show all paths for that Hypster
  HypsterList.addEventListener('change', function(e) {
    var target = e.target,
        type = target.id.split("-")[1];
    if (target.checked) {
      hypsterMgr.add(type);
    } else {
      hypsterMgr.remove(type);
    }
  }, false);
}

function loadPeople(type) {
  //Request Hypster data
  new IO.XHR({
    url: 'data/' + type + '.json',
    onSuccess: function(json) {
      var Hypsters = data.Hypsters[type] = JSON.parse(json),
          html = [];
      html.push('<label for=\'checkbox-' +
          type + '\'><input type=\'checkbox\' id=\'checkbox-' +
          type + '\' /> ' + type + '</label>');

      rightMenu.append('<li>' + html.join('</li><li>') + '</li>');
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
      vs: 'Hypster_layer.vs.glsl',
      fs: 'Hypster_layer.fs.glsl',
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
      src: ['img/earth.jpg']
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

      app.tooltip = $('tooltip');
      //nasty
      window.app = app;
      centerHypster.app = app;
      hypsterMgr.app = app;

      gl.clearColor(255, 255, 255, 1);
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
      $$('#Hypster-list li input')[0].click();
      $('list-wrapper').style.display = '';

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


