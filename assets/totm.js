$(function() {   
    var map = null;
    var innerLocCircle, outerLocCircle;
    var EARTH_RADIUS = 6371000;
    var GRID_SIZE = 30;
    var TRIGGERING_RADIUS = 10;
    var ZOOM_LEVEL = 18;
    var d2r = Math.PI / 180;
    var DENSITY = .6;
    var BLOCK_SIZE = 20;
    var COLUMNS = 10;
    var ROWS = 20;
    var BUFFER_ROWS = 4;
    var NO_TILE = 0;
    var TILE_PRESENT = 1;
    var TILE_USED = 2;
    var score;
    var savedData;
    var dominoes = [{
        label: 'I',
        matrix_0: [[1,1,1,1]],
        matrix_1: [[1],[1],[1],[1]],
        matrix_2: [[1,1,1,1]],
        matrix_3: [[1],[1],[1],[1]],
        colour: '#00ffff'
    }, {
        label: 'O',
        matrix_0: [[1,1],[1,1]],
        matrix_1: [[1,1],[1,1]],
        matrix_2: [[1,1],[1,1]],
        matrix_3: [[1,1],[1,1]],
        colour: '#ffff00'
    }, {
        label: 'T',
        matrix_0: [[1,1,1],[0,1,0]],
        matrix_1: [[0,1],[1,1],[0,1]],
        matrix_2: [[0,1,0],[1,1,1]],
        matrix_3: [[1,0],[1,1],[1,0]],
        colour: '#ff00ff'
    }, {
        label: 'J',
        matrix_0: [[1,1,1],[0,0,1]],
        matrix_1: [[0,1],[0,1],[1,1]],
        matrix_2: [[1,0,0],[1,1,1]],
        matrix_3: [[1,1],[1,0],[1,0]],
        colour: '#0000ff'
    }, {
        label: 'L',
        matrix_0: [[1,1,1],[1,0,0]],
        matrix_1: [[1,1],[0,1],[0,1]],
        matrix_2: [[0,0,1],[1,1,1]],
        matrix_3: [[1,0],[1,0],[1,1]],
        colour: '#ff8000'
    }, {
        label: 'S',
        matrix_0: [[0,1,1],[1,1,0]],
        matrix_1: [[1,0],[1,1],[0,1]],
        matrix_2: [[0,1,1],[1,1,0]],
        matrix_3: [[1,0],[1,1],[0,1]],
        colour: '#00ff00'
    }, {
        label: 'Z',
        matrix_0: [[1,1,0],[0,1,1]],
        matrix_1: [[0,1],[1,1],[1,0]],
        matrix_2: [[1,1,0],[0,1,1]],
        matrix_3: [[0,1],[1,1],[1,0]],
        colour: '#ff0000'
    }];
    var grid;
    var refPos = null;
    var waitingPieces = [];
    var pieceFalling = null;
    var DIRECTION_PRESSED = 0;
    var ROTATE_PRESSED = 0;
    var COUNTDOWN_SECONDS = 5;
    var SCORES = [0, 40, 100, 300, 1200];
    var GAME_STARTED = false;
    var circleStyle = {
        color: "#ff00ff",
        opacity: .8,
        fillOpacity: .2,
        weight: 2
    };
    var blocklist;
    
    function createBlankBlocklist() {
        var res = [];
        for (var i = 0; i < (BUFFER_ROWS+ROWS); i++) {
            var row = [];
            for (var j = 0; j < COLUMNS; j++) {
                row.push(0);
            };
            res.push(row);
        }
        return res;
    }
    
    function startGame(data) {
        savedData = data || {};
        if (savedData.geoRef) {
            refPos = savedData.geoRef;
        }
        grid = {};
        if (savedData.geo_grid) {
            for (var i = 0; i < savedData.geo_grid.length; i++) {
                var g = savedData.geo_grid[i];
                var gridelement = {
                    type: g[1]
                };
                if (g[1] == TILE_PRESENT) {
                    gridelement.domino_type = g[2];
                    gridelement.domino = dominoes[g[2]];
                }
                grid[g[0]] = gridelement;
            }
        }
        score = savedData.score || 0;
        if (!savedData.tile_grid) {
            savedData.tile_grid = createBlankBlocklist();
        }
        blocklist = savedData.tile_grid;
        $("#score").text(score);
        redraw();
    }
       
    function deleteSavedGame() {
        window.localStorage.removeItem('saved-game');
    }
    
    function commitChanges() {
        window.localStorage.setItem('saved-game',JSON.stringify(savedData));
    }
    
    function saveGeoPart() {
        var savedGrid = [];
        for (var k in grid) {
            var sge = [k,grid[k].type];
            if (grid[k].type == TILE_PRESENT) {
                sge.push(grid[k].tile_type);
            }
            savedGrid.push(sge);
        }
        savedData.geo_ref = [refPos.lat, refPos.lng];
        savedData.geo_grid = savedGrid;
        savedData.score = score;
        commitChanges();
    }
    
    function saveTilePart() {
        savedData.score = score;
        commitChanges();
    }
    
    function getDominoHeight(domino, position) {
        return domino['matrix_'+position].length;
    }
    
    function getDominoWidth(domino, position) {
        return domino['matrix_'+position][0].length;
    }
    
    dominoes.forEach(function(domino) {
        var IMGSIZE = 50;
        var SQSIZE = 12;
        var cv = document.createElement('canvas');
        cv.width = IMGSIZE;
        cv.height = IMGSIZE;
        ctx = cv.getContext('2d');
        var width = getDominoWidth(domino,0),
            height = getDominoHeight(domino,0);
        ctx.translate(IMGSIZE/2,IMGSIZE/2);
        ctx.rotate(-Math.PI/8);
        for (var i = 0; i < width; i++) {
            for (var j = 0; j < height; j++) {
                if (domino.matrix_0[j][i]) {
                    var x = (i - width/2) * SQSIZE;
                    var y = (j - height/2) * SQSIZE;
                    ctx.fillStyle = domino.colour;
                    ctx.strokeStyle = '#404040';
                    ctx.lineWidth = 1;
                    ctx.rect(x,y,SQSIZE,SQSIZE);
                    ctx.fill();
                    ctx.stroke();
                }
            }
        }
        domino.image = cv.toDataURL();
        domino.leaflet_icon = L.icon({
            iconUrl: domino.image,
            iconSize: [IMGSIZE, IMGSIZE],
            iconAnchor: [IMGSIZE/2, IMGSIZE/2]
        });
    });
    
    function getLatLng(pos) {
        return [pos.coords.latitude, pos.coords.longitude];
    }
        
    function latLngToGrid(latlng) {
        if (!refPos) {
            var reflat = Math.round(latlng[0]);
            refPos = {
                lat: reflat,
                lng: Math.round(latlng[1]),
                coslat: Math.cos(d2r * reflat),
            };
        };
        var x = d2r * (latlng[1]-refPos.lng) * refPos.coslat * EARTH_RADIUS / GRID_SIZE;
        var y = d2r * (latlng[0]-refPos.lat) * EARTH_RADIUS / GRID_SIZE;
        return [x, y];
    }
    
    function gridToLatLng(grid) {
        var latr = grid[1] * GRID_SIZE / EARTH_RADIUS;
        var lngr = grid[0] * GRID_SIZE / EARTH_RADIUS / refPos.coslat;
        return [ refPos.lat + latr / d2r, refPos.lng + lngr / d2r ];
    }
    
    function initializeMap(pos) {
        map = L.map('map', {
            minZoom: ZOOM_LEVEL,
            maxZoom: ZOOM_LEVEL,
            zoom: ZOOM_LEVEL,
            center: getLatLng(pos),
            zoomControl: false
        });
        map.dragging.disable();
        L.tileLayer(
            'http://{s}.tile.osm.org/{z}/{x}/{y}.png',
            { attribution: '&copy; OpenStreetMap contributors' }
        ).addTo(map);
        outerLocCircle = L.circle(
            getLatLng(pos),
            pos.coords.accuracy,
            circleStyle
        ).addTo(map);
        innerLocCircle = L.circle(
            getLatLng(pos),
            2,
            circleStyle
        ).addTo(map);
    }
        
    function deleteTileOnMap(gridelement) {
        var $img = $('<img>');
        $img.attr("src", gridelement.domino.image);
        $('#next').append($img);
        map.removeLayer(gridelement.marker);
        gridelement.circle.setStyle({
            color: "#cccccc"
        });
        gridelement.type = TILE_USED;
        delete gridelement.marker;
        delete gridelement.domino;
        $(window).scrollTop($('#blocks').position().top);
        saveGeoPart();
    }
    
    function getTile(gridelement) {
        waitingPieces.push(gridelement.domino);
        deleteTileOnMap(gridelement);
    }
        
    function getTileCountdown(gridelement) {
        var domino = gridelement.domino;
        deleteTileOnMap(gridelement);
        var countdown_dest = Date.now() + COUNTDOWN_SECONDS*1000,
            interval;
        function iterate() {
            if (Date.now() >= countdown_dest) {
                window.clearInterval(interval);
                waitingPieces.push(domino);
            } else {
                var nsec = Math.round((countdown_dest-Date.now())/1000);
                $('#countdown').text('Tile will fall in ' + nsec + ' second' + (nsec > 1 ? 's': ''));
            }
        }
        var interval = setInterval(iterate, 300);
    }
    
    function addElementOnMap(gridcoord) {
        var gridelement = grid[gridcoord] || {};
        var coords = gridToLatLng(gridcoord.split(','));
        gridelement.on_map = true;
        switch (gridelement.type) {
            case TILE_PRESENT:
                gridelement.marker = L.marker(
                    coords,
                    {
                        'icon': gridelement.domino.leaflet_icon
                    }
                ).addTo(map);
                gridelement.marker.on('click', function() {
                    score -= 10;
                    $('#score').text(score);
                    getTile(gridelement);
                });
                gridelement.circle = L.circle(
                    coords,
                    TRIGGERING_RADIUS,
                    {
                        color: "#00ffff",
                        opacity: .8,
                        fillOpacity: .1,
                        weight: 6
                    }
                ).addTo(map);
            break;
            case TILE_USED:
                gridelement.circle = L.circle(
                    coords,
                    TRIGGERING_RADIUS,
                    {
                        color: "#cccccc",
                        opacity: .8,
                        fillOpacity: .1,
                        weight: 6
                    }
                ).addTo(map);
            break;
        }
    }
    
    function checkElements() {
        for (var k in grid) {
            if (!grid[k].on_map) {
                addElementOnMap(k);
            }
        }
    }
    
    function addTile(x,y) {
        var gridcoord = [x,y].join(',');
        if (!grid[gridcoord]) {
            var gridelement = {};
            var n = Math.floor(Math.random()*dominoes.length/DENSITY);
            if (n < dominoes.length) {
                gridelement.type = TILE_PRESENT;
                gridelement.tile_type = n;
                gridelement.domino = dominoes[n];
            } else {
                gridelement.type = NO_TILE;
            }
            grid[gridcoord] = gridelement;
            saveGeoPart();
        }
    }
    
    function addTiles(xy) {
        var xbase = Math.floor(xy[0]);
        var ybase = Math.floor(xy[1]);
        for (var i = -2; i < 4; i++) {
            for (var j = -2; j < 4; j++) {
                var x = xbase + i;
                var y = ybase + j;
                addTile(x, y);
            }
        }
        checkElements();
    }
    
    function locationsuccess(pos) {
        if (!map) {
            initializeMap(pos);
        } else {
            map.panTo(getLatLng(pos));
            innerLocCircle.setStyle(circleStyle).setLatLng(getLatLng(pos));
            outerLocCircle.setStyle(circleStyle).setLatLng(getLatLng(pos)).setRadius(pos.coords.accuracy);
        }
        var gridpos = latLngToGrid(getLatLng(pos));
        addTiles(gridpos);
        //Checking if we're triggering a location
        var closestx = Math.round(gridpos[0]);
        var closesty = Math.round(gridpos[1]);
        var gridelement = grid[[closestx,closesty].join(',')] || {};
        if (gridelement.type == TILE_PRESENT) {
            var dx = gridpos[0] - closestx;
            var dy = gridpos[1] - closesty;
            var dist = Math.sqrt(dx*dx + dy*dy) * GRID_SIZE;
            if (dist < TRIGGERING_RADIUS) {
                $('#closest').text("Congratulations, you've collected a tile!");
                score += 4;
                $('#score').text(score);
                getTileCountdown(gridelement);
            } else {
                $('#closest').text("There's a tile just " + ~~dist + " metres away!");
            }
        } else {
            $('#closest').text("You're a bit far from the closest tile, try moving!");
        }
        
    }
    
    function locationerror(pos) {
        if (map) {
            var style = {
                opacity: 0,
                fillOpacity: 0,
            };
            innerLocCircle.setStyle(style);
            outerLocCircle.setStyle(style);
        }
    }
    
    $('#blocks').attr({
        width: COLUMNS * BLOCK_SIZE,
        height: ROWS * BLOCK_SIZE
    });
    
    function redraw() {
        window.requestAnimationFrame(function() {
            var ctx = $('#blocks')[0].getContext('2d');
            ctx.clearRect(0,0,COLUMNS * BLOCK_SIZE,ROWS * BLOCK_SIZE);
            ctx.strokeStyle = "#000000";
            for (var i = 0; i < ROWS; i++) {
                for (var j = 0; j < COLUMNS; j++) {
                    var b = blocklist[BUFFER_ROWS+i][j];
                    if (b) {
                        ctx.fillStyle = b;
                        ctx.beginPath();
                        ctx.rect(j * BLOCK_SIZE, i * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                        ctx.fill();
                        ctx.stroke();
                    }
                }
            }
        });
    }
        
    function getProjectedPositions(pe) {
        var projectedElement = pe || {};
        var x = projectedElement.x || pieceFalling.x;
        var y = projectedElement.y || pieceFalling.y;
        var direction = projectedElement.direction || pieceFalling.direction;
        var projectedPositions = [];
        var matrix = pieceFalling.domino['matrix_'+direction];
        for (var i = 0; i < matrix.length; i++) {
            for (var j = 0; j < matrix[0].length; j++) {
                if (matrix[i][j]) {
                    projectedPositions.push([x+j, y+i]);
                }
            }
        }
        for (k = 0; k < projectedPositions.length; k++) {
            var x = projectedPositions[k][0];
            var y = projectedPositions[k][1];
            if (x >= COLUMNS || x < 0 || y >= (BUFFER_ROWS+ROWS) || blocklist[y][x]) {
                return null;
            }
        }
        return projectedPositions;
    }
    
    function setColour(positions, colour) {
        (positions || []).forEach(function(yx) {
            blocklist[yx[1]][yx[0]] = colour;
        });
    }
    
    var refreshInterval;
    
    function refreshLoop() {
        if (!pieceFalling) {
            if (waitingPieces.length) {
                $('#next img:first-child').remove();
                $('#countdown').text('Play blocks now!');
                //document.getElementById('next').removeChild(document.getElementById('next').getElementsByTagName('img')[0]);
                pieceFalling = {
                    domino: waitingPieces.shift(),
                    direction: Math.floor(4*Math.random())
                };
                var width = getDominoWidth(pieceFalling.domino, pieceFalling.direction);
                var height = getDominoHeight(pieceFalling.domino, pieceFalling.direction);
                pieceFalling.x = Math.floor(Math.random()*(COLUMNS - width));
                pieceFalling.y = BUFFER_ROWS - height;
                pieceFalling.positions = getProjectedPositions();
            }
        }
        if (pieceFalling) {
            setColour(pieceFalling.positions, 0);
            var stopFalling = false;
            if (ROTATE_PRESSED % 4) {
                var newrot = (pieceFalling.direction + ROTATE_PRESSED) % 4;
                var currentwidth = getDominoWidth(pieceFalling.domino, pieceFalling.direction);
                var newwidth = getDominoWidth(pieceFalling.domino, newrot);
                var xshift = ~~((currentwidth-newwidth)/2);
                var rotatePP = getProjectedPositions({
                    direction: newrot,
                    x: (pieceFalling.x + xshift)
                });
                if (rotatePP) {
                    pieceFalling.x += xshift;
                    pieceFalling.direction = newrot;
                    pieceFalling.positions = rotatePP;
                }
            }
            var absdir = Math.abs(DIRECTION_PRESSED);
            for (var i = absdir; i; i--) {
                var totaldir = i * DIRECTION_PRESSED / absdir;
                var shiftPP = getProjectedPositions({
                    x: pieceFalling.x + totaldir
                });
                if (shiftPP) {
                    pieceFalling.x += totaldir;
                    pieceFalling.positions = shiftPP;
                    break;
                }
            }
            var downPP = getProjectedPositions({
                y: pieceFalling.y + 1
            });
            if (downPP) {
                pieceFalling.y += 1;
                pieceFalling.positions = downPP;
            } else {
                stopFalling = true;
            }
            setColour(pieceFalling.positions, pieceFalling.domino.colour);
            if (stopFalling) {
                pieceFalling = null;
                if (!waitingPieces.length) {
                    $(window).scrollTop(0);
                    $('#countdown').text('Collect tiles to play!');
                }
                /* CHECK IF LINES HAVE BEEN CLEARED */
                var i = BUFFER_ROWS;
                while (i < blocklist.length) {
                    var line = blocklist[i];
                    var hasZeroes = false;
                    for (var j = 0; j < COLUMNS; j++) {
                        if (!line[j]) {
                            hasZeroes = true;
                            break;
                        }
                    }
                    if (hasZeroes) {
                        i++;
                    } else {
                        linesDiscarded++;
                        blocklist.splice(i,1);
                    }
                }
                var linesDiscarded = BUFFER_ROWS+ROWS-blocklist.length;
                for (var i = 0; i < linesDiscarded; i++) {
                    var newline = [];
                    for (var j = 0; j < COLUMNS; j++) {
                        newline.push(0);
                    }
                    blocklist.splice(0,0,newline);
                }
                score += SCORES[linesDiscarded];
                $('#score').text(score);
                for (var i = BUFFER_ROWS; i; i--) {
                    var line = blocklist[i-1];
                    var allZeroes = true;
                    for (var j = 0; j < COLUMNS; j++) {
                        if (!!line[j]) {
                            allZeroes = false;
                            break;
                        }
                    }
                    if (!allZeroes) {
                        window.clearInterval(refreshInterval);
                        $('#countdown,#closest').text("GAME OVER");
                        deleteSavedGame();
                        window.alert('Game over!');
                    } else {
                        saveTilePart();
                    }
                }
            }
            //console.log(JSON.stringify(blocklist));
            redraw();
        }
        DIRECTION_PRESSED = 0;
        ROTATE_PRESSED = 0;
    }
        
    
    $('#moveleft').click(function() {
        DIRECTION_PRESSED--;
        return false;
    });
    $('#moveright').click(function() {
        DIRECTION_PRESSED++;
        return false;
    });
    $('#rotate').click(function() {
        ROTATE_PRESSED++;
        return false;
    });
    
    var savedGameStr = window.localStorage.getItem('saved-game');
    
    if (savedGameStr && confirm('Do you wish to continue the game you were playing?')) {
        startGame(JSON.parse(window.localStorage.getItem('saved-game')));
    } else {
        window.localStorage.removeItem('saved-game');
        startGame({});
    }
    
    window.navigator.geolocation.watchPosition(
        locationsuccess,
        locationerror,
        { enableHighAccuracy: true }
    );
    
    refreshInterval = window.setInterval(refreshLoop, 200);
    
});
