class HandGestureDetector {
  constructor() {
    this.video = document.getElementById('video');
    this.canvas = document.getElementById('output');
    this.ctx = this.canvas.getContext('2d');
    this.gestureValue = document.getElementById('gestureValue');
    this.handStatus = document.getElementById('handStatus');
    this.frameRateElement = document.getElementById('fps');
    this.detectionTimeElement = document.getElementById('detectionTime');
    this.errorDiv = document.getElementById('error');
    
   
    this.startBtn = document.getElementById('startBtn');
    this.stopBtn = document.getElementById('stopBtn');
    this.flipBtn = document.getElementById('flipBtn');
    this.confidenceSlider = document.getElementById('confidence');
    this.maxHandsSlider = document.getElementById('maxHands');
    
    this.isRunning = false;
    this.camera = null;
    this.hands = null;
    this.animationId = null;
    this.fps = 0;
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
    this.detectionTimes = [];
    this.currentFacingMode = 'user';
    
    this.init();
  }

  init() {
    this.setupCanvas();
    this.setupEventListeners();
    this.initMediaPipe();
    this.startFpsCounter();
  }

  setupCanvas() {
    this.canvas.width = this.video.offsetWidth;
    this.canvas.height = this.video.offsetHeight;
  }

  setupEventListeners() {
    this.startBtn.addEventListener('click', () => this.startDetection());
    this.stopBtn.addEventListener('click', () => this.stopDetection());
    this.flipBtn.addEventListener('click', () => this.flipCamera());
    
    this.confidenceSlider.addEventListener('input', (e) => {
      document.getElementById('confValue').textContent = e.target.value;
      if (this.hands) {
        this.hands.setOptions({ minDetectionConfidence: parseFloat(e.target.value) });
      }
    });
    
    this.maxHandsSlider.addEventListener('input', (e) => {
      document.getElementById('handsValue').textContent = e.target.value;
      if (this.hands) {
        this.hands.setOptions({ maxNumHands: parseInt(e.target.value) });
      }
    });
    
   
    window.addEventListener('resize', () => {
      this.setupCanvas();
    });
  }

  initMediaPipe() {
    this.hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6
    });

    this.hands.onResults((results) => {
      const startTime = performance.now();
      this.onResults(results);
      const endTime = performance.now();
      this.updateDetectionTime(endTime - startTime);
    });
  }

  async startDetection() {
    try {
      this.errorDiv.classList.remove('show');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.currentFacingMode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      this.video.srcObject = stream;
      await this.video.play();
      
      this.isRunning = true;
      this.startBtn.disabled = true;
      this.stopBtn.disabled = false;
      this.startBtn.innerHTML = '<span class="btn-icon">⏸️</span>Detection Running...';
      
      this.processFrame();
      
    } catch (error) {
      this.showError('Error accessing webcam: ' + error.message);
    }
  }

  async processFrame() {
    if (!this.isRunning) return;
    
    try {
      await this.hands.send({ image: this.video });
      this.animationId = requestAnimationFrame(() => this.processFrame());
    } catch (error) {
      console.error('Frame processing error:', error);
    }
  }

  onResults(results) {
    this.frameCount++;
    const currentTime = performance.now();
    
   
    if (currentTime - this.lastFrameTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFrameTime));
      this.frameRateElement.textContent = `FPS: ${this.fps}`;
      this.frameCount = 0;
      this.lastFrameTime = currentTime;
    }
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
  
    this.ctx.scale(-1, 1);
    this.ctx.translate(-this.canvas.width, 0);
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      
     
      this.drawHand(landmarks, results.multiHandedness[0].label);
      
     
      const gesture = this.detectGesture(landmarks);
      this.updateGestureDisplay(gesture);
      this.updateHandStatus(`Hand detected (${results.multiHandedness[0].label})`);
      
    } else {
      this.updateGestureDisplay('None');
      this.updateHandStatus('No hand detected');
    }
    
    this.ctx.restore();
  }

  drawHand(landmarks, handedness) {
  
    const lineColor = handedness === 'Right' ? 'rgba(0, 255, 72, 0.8)' : 'rgba(255, 72, 0, 0.8)';
    const pointColor = handedness === 'Right' ? 'rgba(0, 26, 255, 0.9)' : 'rgba(255, 26, 0, 0.9)';
    
  
    drawConnectors(this.ctx, landmarks, HAND_CONNECTIONS, {
      color: lineColor,
      lineWidth: 3
    });
    
   
    drawLandmarks(this.ctx, landmarks, {
      color: pointColor,
      lineWidth: 2,
      radius: 4
    });
    
  
    const palm = landmarks[0];
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.beginPath();
    this.ctx.arc(palm.x * this.canvas.width, palm.y * this.canvas.height, 6, 0, 2 * Math.PI);
    this.ctx.fill();
  }

  detectGesture(landmarks) {
    const fingerTips = [8, 12, 16, 20];
    const fingerBases = [6, 10, 14, 18];
    
   
    let openFingers = 0;
    for (let i = 0; i < 4; i++) {
      const tip = landmarks[fingerTips[i]];
      const base = landmarks[fingerBases[i]];
      const isOpen = tip.y < base.y;
      if (isOpen) openFingers++;
    }
    
    
    const isRightHand = landmarks[4].x < landmarks[2].x;
    const thumbOpen = isRightHand ? landmarks[4].x < landmarks[3].x : landmarks[4].x > landmarks[3].x;
    
    
    if (openFingers === 4 && thumbOpen) return "Open Palm";
    if (openFingers === 0 && !thumbOpen) return "Fist";
    if (openFingers === 2 && !thumbOpen) {

      const indexOpen = landmarks[8].y < landmarks[6].y;
      const middleOpen = landmarks[12].y < landmarks[10].y;
      const ringClosed = landmarks[16].y > landmarks[14].y;
      const pinkyClosed = landmarks[20].y > landmarks[18].y;
      
      if (indexOpen && middleOpen && ringClosed && pinkyClosed) {
        return "Peace Sign ✌️";
      }
    }
    if (openFingers === 0 && thumbOpen) return "Thumbs Up 👍";
    if (openFingers === 2 && thumbOpen) return "Love You 🤟";
    if (openFingers === 1 && !thumbOpen) return "Pointing 👆";
    if (openFingers === 3 && thumbOpen) return "OK 👌";
    
    return "Unknown";
  }

  updateGestureDisplay(gesture) {
    this.gestureValue.textContent = gesture;
    
   
    document.querySelectorAll('.gesture-item').forEach(item => {
      item.classList.toggle('active', 
        item.dataset.gesture && gesture.includes(item.dataset.gesture)
      );
    });
  }

  updateHandStatus(status) {
    this.handStatus.textContent = status;
    this.handStatus.style.color = status.includes('detected') 
      ? 'var(--success-color)' 
      : 'var(--text-secondary)';
  }

  updateDetectionTime(time) {
    this.detectionTimes.push(time);
    if (this.detectionTimes.length > 10) {
      this.detectionTimes.shift();
    }
    
    const avgTime = this.detectionTimes.reduce((a, b) => a + b, 0) / this.detectionTimes.length;
    this.detectionTimeElement.textContent = `${avgTime.toFixed(1)} ms`;
  }

  startFpsCounter() {
    setInterval(() => {
      document.getElementById('frameRate').textContent = `${this.fps} fps`;
    }, 500);
  }

  async flipCamera() {
    this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
    
    if (this.isRunning) {
      await this.stopDetection();
      await new Promise(resolve => setTimeout(resolve, 500));
      await this.startDetection();
    }
  }

  async stopDetection() {
    this.isRunning = false;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    if (this.video.srcObject) {
      const tracks = this.video.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      this.video.srcObject = null;
    }
    
    this.startBtn.disabled = false;
    this.stopBtn.disabled = true;
    this.startBtn.innerHTML = '<span class="btn-icon">▶️</span>Start Detection';
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.updateGestureDisplay('None');
    this.updateHandStatus('Detection stopped');
  }

  showError(message) {
    this.errorDiv.textContent = message;
    this.errorDiv.classList.add('show');
    
    setTimeout(() => {
      this.errorDiv.classList.remove('show');
    }, 5000);
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new HandGestureDetector();
});