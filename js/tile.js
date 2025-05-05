// js/tile.js - Should be identical to original 2048 version
function Tile(position, value) {
    this.x                = position.x;
    this.y                = position.y;
    this.value            = value || 1; // Default spawn value MUST be 1 for Fibonacci
  
    this.previousPosition = null;
    this.mergedFrom       = null; // Tracks tiles that merged into this one
  }
  
  Tile.prototype.savePosition = function () {
    this.previousPosition = { x: this.x, y: this.y };
  };
  
  Tile.prototype.updatePosition = function (position) {
    this.x = position.x;
    this.y = position.y;
  };
  
  Tile.prototype.serialize = function () {
    return {
      position: {
        x: this.x,
        y: this.y
      },
      value: this.value
    };
  };