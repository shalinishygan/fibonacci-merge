// js/game_manager.js
function GameManager(size, InputManager, Actuator, StorageManager) {
    this.size           = size; // Size of the grid
    this.inputManager   = new InputManager;
    this.storageManager = new StorageManager;
    this.actuator       = new Actuator;
  
    this.startTiles     = 2; // Start with two '1' tiles
  
    this.inputManager.on("move", this.move.bind(this));
    this.inputManager.on("restart", this.restart.bind(this));
    this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));
  
    // --- Fibonacci Merge Specific ---
    this.winValue = 144; // Target Fibonacci number
    // Precompute Fibonacci numbers up to a bit beyond the win value for quick checking
    this.fibonacciNumbers = this.generateFibonacciSet(25); // Generate first 25 Fib numbers
  
    this.setup();
  }
  
  // --- NEW HELPER: Generate a Set of Fibonacci numbers for fast lookups ---
  GameManager.prototype.generateFibonacciSet = function(count) {
      var fibSet = new Set();
      var a = 1, b = 1;
      fibSet.add(a); // Add the first '1'
      for (var i = 1; i < count; i++) { // Start from 1 since first '1' is added
          fibSet.add(b);
          var temp = a;
          a = b;
          b = temp + b;
      }
      // console.log("Generated Fibonacci Set:", fibSet); // For debugging
      return fibSet;
  };
  
  // --- NEW HELPER: Check if a number is in our Fibonacci set ---
  GameManager.prototype.isFibonacci = function(num) {
      return this.fibonacciNumbers.has(num);
  };
  
  // --- NEW HELPER: Check if two numbers are consecutive Fibonacci numbers ---
  GameManager.prototype.areConsecutiveFibonacci = function(val1, val2) {
      // Handle the special case 1 + 1 = 2
      if (val1 === 1 && val2 === 1) {
          return true;
      }
      // Ensure both are Fibonacci numbers
      if (!this.isFibonacci(val1) || !this.isFibonacci(val2)) {
          return false;
      }
      // Check if their sum is also a Fibonacci number
      // This works because if F(n) + F(m) = F(k), and n,m,k are indices > 1,
      // then it must be that m = n+1 (or vice versa) and k = n+2
      // For the base case 1+1=2 (F1+F2=F3), it also works.
      return this.isFibonacci(val1 + val2);
  };
  
  
  // Restart the game
  GameManager.prototype.restart = function () {
    this.storageManager.clearGameState();
    this.actuator.continueGame(); // Clear the game won/lost message
    this.setup();
  };
  
  // Keep playing after winning
  GameManager.prototype.keepPlaying = function () {
    this.keepPlaying = true;
    this.actuator.continueGame(); // Clear the game won/lost message
  };
  
  // Return true if the game is lost, or has won and the user hasn't kept playing
  GameManager.prototype.isGameTerminated = function () {
    return this.over || (this.won && !this.keepPlaying);
  };
  
  // Set up the game
  GameManager.prototype.setup = function () {
    var previousState = this.storageManager.getGameState();
  
    if (previousState) {
      this.grid        = new Grid(previousState.grid.size,
                                  previousState.grid.cells); // Reload grid
      this.score       = previousState.score;
      this.over        = previousState.over;
      this.won         = previousState.won;
      this.keepPlaying = previousState.keepPlaying;
      // Ensure fibonacciNumbers is still set
      if (!this.fibonacciNumbers) {
         this.fibonacciNumbers = this.generateFibonacciSet(25);
      }
    } else {
      this.grid        = new Grid(this.size);
      this.score       = 0;
      this.over        = false;
      this.won         = false;
      this.keepPlaying = false;
      if (!this.fibonacciNumbers) {
         this.fibonacciNumbers = this.generateFibonacciSet(25);
      }
      // Add the initial tiles
      this.addStartTiles();
    }
  
    // Update the actuator
    this.actuate();
  };
  
  // Set up the initial tiles to start the game with
  GameManager.prototype.addStartTiles = function () {
    for (var i = 0; i < this.startTiles; i++) {
      this.addRandomTile();
    }
  };
  
  // Adds a tile in a random position
  GameManager.prototype.addRandomTile = function () {
    if (this.grid.cellsAvailable()) {
      // --- Fibonacci: ALWAYS spawn a '1' ---
      var value = 1;
      var tile = new Tile(this.grid.randomAvailableCell(), value);
  
      this.grid.insertTile(tile);
    }
  };
  
  // Sends the updated grid to the actuator
  GameManager.prototype.actuate = function () {
    if (this.storageManager.getBestScore() < this.score) {
      this.storageManager.setBestScore(this.score);
    }
  
    if (this.over) {
      this.storageManager.clearGameState();
    } else {
      this.storageManager.setGameState(this.serialize());
    }
  
    this.actuator.actuate(this.grid, {
      score:      this.score,
      over:       this.over,
      won:        this.won,
      bestScore:  this.storageManager.getBestScore(),
      terminated: this.isGameTerminated()
    });
  
  };
  
  // Represent the current game as an object
  GameManager.prototype.serialize = function () {
    return {
      grid:        this.grid.serialize(),
      score:       this.score,
      over:        this.over,
      won:         this.won,
      keepPlaying: this.keepPlaying
    };
  };
  
  // Save all tile positions and remove merger info
  GameManager.prototype.prepareTiles = function () {
    this.grid.eachCell(function (x, y, tile) {
      if (tile) {
        tile.mergedFrom = null;
        tile.savePosition();
      }
    });
  };
  
  // Move a tile and its representation
  GameManager.prototype.moveTile = function (tile, cell) {
    this.grid.cells[tile.x][tile.y] = null;
    this.grid.cells[cell.x][cell.y] = tile;
    tile.updatePosition(cell);
  };
  
  // Move tiles on the grid in the specified direction
  // *** THIS IS THE CORE LOGIC CHANGE ***
  GameManager.prototype.move = function (direction) {
    // 0: up, 1: right, 2: down, 3: left
    var self = this;
  
    if (this.isGameTerminated()) return; // Don't do anything if the game's over
  
    var cell, tile;
  
    var vector     = this.getVector(direction);
    var traversals = this.buildTraversals(vector);
    var moved      = false;
  
    // Save the current tile positions and remove merger information
    this.prepareTiles();
  
    // Traverse the grid in the right direction and move tiles
    traversals.x.forEach(function (x) {
      traversals.y.forEach(function (y) {
        cell = { x: x, y: y };
        tile = self.grid.cellContent(cell);
  
        if (tile) {
          var positions = self.findFarthestPosition(cell, vector);
          var next      = self.grid.cellContent(positions.next);
  
          // *** FIBONACCI MERGE LOGIC ***
          // Check if the next cell has a tile, it hasn't merged already,
          // AND they are consecutive Fibonacci numbers
          if (next && !next.mergedFrom && self.areConsecutiveFibonacci(tile.value, next.value)) {
             var mergedValue = tile.value + next.value;
             var merged = new Tile(positions.next, mergedValue);
             merged.mergedFrom = [tile, next]; // Record the merge
  
             self.grid.insertTile(merged); // Place the new merged tile
             self.grid.removeTile(tile);   // Remove the moving tile
  
             // Converge the two tile positions
             tile.updatePosition(positions.next);
  
             // Update the score with the value of the NEW tile
             self.score += merged.value;
  
             // Check for win condition
             if (merged.value === self.winValue && !self.won) {
               self.won = true; // Target reached!
             }
             // Ensure the new merged tile doesn't merge again immediately
             // merged.mergedFrom is already set, which prevents this
  
             moved = true; // Mark that a merge happened
          } else {
            // If no merge, just move the tile to the farthest empty spot
            if (!self.positionsEqual(cell, positions.farthest)) {
                self.moveTile(tile, positions.farthest);
                moved = true; // Mark that a move happened
            }
          }
        }
      });
    });
  
    if (moved) {
      this.addRandomTile(); // Add a new '1' tile
  
      if (!this.movesAvailable()) {
        this.over = true; // Game over!
      }
  
      this.actuate();
    }
  };
  
  
  // Get the vector representing the chosen direction
  GameManager.prototype.getVector = function (direction) {
    // Vectors representing tile movement
    var map = {
      0: { x: 0,  y: -1 }, // Up
      1: { x: 1,  y: 0 },  // Right
      2: { x: 0,  y: 1 },  // Down
      3: { x: -1, y: 0 }   // Left
    };
    return map[direction];
  };
  
  // Build a list of positions to traverse in the right order
  GameManager.prototype.buildTraversals = function (vector) {
    var traversals = { x: [], y: [] };
  
    for (var pos = 0; pos < this.size; pos++) {
      traversals.x.push(pos);
      traversals.y.push(pos);
    }
  
    // Always traverse from the farthest cell in the chosen direction
    if (vector.x === 1) traversals.x = traversals.x.reverse();
    if (vector.y === 1) traversals.y = traversals.y.reverse();
  
    return traversals;
  };
  
  GameManager.prototype.findFarthestPosition = function (cell, vector) {
    var previous;
  
    // Progress towards the vector direction until an obstacle is found
    do {
      previous = cell;
      cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
    } while (this.grid.withinBounds(cell) &&
             this.grid.cellAvailable(cell));
  
    return {
      farthest: previous,
      next: cell // Used to check merging
    };
  };
  
  GameManager.prototype.movesAvailable = function () {
    return this.grid.cellsAvailable() || this.tileMatchesAvailable();
  };
  
  // Check for available matches between tiles
  // *** MODIFIED FOR FIBONACCI RULES ***
  GameManager.prototype.tileMatchesAvailable = function () {
    var self = this;
    var tile;
  
    for (var x = 0; x < this.size; x++) {
      for (var y = 0; y < this.size; y++) {
        tile = this.grid.cellContent({ x: x, y: y });
  
        if (tile) {
          // Check neighbors (right and down is sufficient)
          for (var direction = 1; direction <= 2; direction++) { // Check right (1) and down (2)
            var vector = self.getVector(direction);
            var cell   = { x: x + vector.x, y: y + vector.y };
            var other  = self.grid.cellContent(cell);
  
            // If neighbor exists, check if they are consecutive Fibonacci
            if (other && self.areConsecutiveFibonacci(tile.value, other.value)) {
              return true; // Found a potential merge
            }
          }
        }
      }
    }
  
    return false; // No potential merges found
  };
  
  GameManager.prototype.positionsEqual = function (first, second) {
    return first.x === second.x && first.y === second.y;
  };