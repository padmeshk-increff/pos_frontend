import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast';
import { handleHttpError } from '../../utils/error-handler';
import { UserForm } from '../../models/user.model';

@Component({
  selector: 'app-signup-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrls: ['./signup.css']
})
export class SignupPageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('particleCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  public form: UserForm = { email: '', password: '' };
  public confirmPassword = '';
  public isLoading = false;

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animationFrameId: number | null = null;
  
  // Particle system - clean structure
  private particles: Particle[] = [];
  private mouse = { x: 0, y: 0, targetX: 0, targetY: 0, isActive: false };
  private mouseIdleTimeout: any;
  
  // Cursor glow effect - velocity-based
  public cursorX = 0;
  public cursorY = 0;
  public glowIntensity = 0.2;
  private lastCursorX = 0;
  private lastCursorY = 0;
  private lastMoveTime = 0;
  private cursorVelocity = 0;
  private velocityHistory: number[] = [];
  private readonly maxVelocityHistory = 5;
  
  // Trail system
  private trailCircles: TrailCircle[] = [];
  private readonly maxTrailCircles = 12;
  private isCursorInViewport = false;
  private trailOpacity = 0;
  private isExiting = false;
  private exitVelocity = { vx: 0, vy: 0 };
  private isCursorInAuthCard = false;
  private trailVelocities: { vx: number; vy: number }[] = [];
  private previousTrailPositions: { x: number; y: number }[] = [];
  private trailPositionHistory: { x: number; y: number; time: number }[][] = []; // History for each circle
  
  // Trail glow - separate opacity for smooth fade
  private trailGlowOpacity = 0;
  private trailGlowTargetOpacity = 0;
  private trailTipVelocity = 0;
  private lastTrailTipX = 0;
  private lastTrailTipY = 0;
  private lastTrailTipTime = 0;
  private trailTipVelocityHistory: number[] = [];

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    // Periodic gentle refresh if all particles are at rest
    setInterval(() => {
      const allAtRest = this.particles.every(p => {
        const dx = p.x - p.originalX;
        const dy = p.y - p.originalY;
        return Math.sqrt(dx * dx + dy * dy) < 5;
      });
      
      if (allAtRest && this.particles.length > 0) {
        this.particles.forEach(p => {
          p.originalX += (Math.random() - 0.5) * 10;
          p.originalY += (Math.random() - 0.5) * 10;
        });
      }
    }, 600000); // 10 minutes
  }

  ngAfterViewInit(): void {
    this.initParticleSystem();
    this.animate();
    this.setupEventListeners();
    this.setupAuthCardListeners();
    
    // Initialize cursor position
    this.cursorX = window.innerWidth / 2;
    this.cursorY = window.innerHeight / 2;
    this.lastCursorX = this.cursorX;
    this.lastCursorY = this.cursorY;
    this.updateGlowCSS();
  }

  ngOnDestroy(): void {
    this.removeEventListeners();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.mouseIdleTimeout) {
      clearTimeout(this.mouseIdleTimeout);
    }
  }

  private initParticleSystem(): void {
    this.canvas = this.canvasRef.nativeElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.resizeCanvas();
    this.createParticles();
    this.initTrailCircles();
  }

  private resizeCanvas(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private createParticles(): void {
    // Enhanced particle system with more variation and better visibility
    const particleCount = Math.floor((window.innerWidth * window.innerHeight) / 15000);
    this.particles = [];
    
    // Create an enhanced grid with more organic variation
    const baseSpacing = 100; // Base distance between particles
    const cols = Math.ceil(this.canvas.width / baseSpacing) + 2;
    const rows = Math.ceil(this.canvas.height / baseSpacing) + 2;
    
    // Create particles with enhanced visual variation and better visibility
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Hexagonal grid: offset every other row for better connections
        const offsetX = (row % 2 === 1) ? baseSpacing / 2 : 0;
        const baseX = col * baseSpacing + offsetX;
        const baseY = row * baseSpacing * 0.866; // 0.866 = sqrt(3)/2 for hex grid
        
        // Add more organic variation - stronger wave-like distortion
        const waveX = Math.sin(row * 0.25) * 15 + Math.cos(col * 0.35) * 12;
        const waveY = Math.cos(row * 0.35) * 15 + Math.sin(col * 0.25) * 12;
        
        // Add more random variation to break up structure
        const randomOffsetX = (Math.random() - 0.5) * 20;
        const randomOffsetY = (Math.random() - 0.5) * 20;
        
        // Sometimes skip particles to create gaps and break structure
        if (Math.random() < 0.05) continue; // 5% chance to skip
        
        const x = baseX + waveX + randomOffsetX;
        const y = baseY + waveY + randomOffsetY;
        
        // Only add if within canvas bounds (with margin for variation)
        if (x >= -20 && x <= this.canvas.width + 20 && y >= -20 && y <= this.canvas.height + 20) {
          // Create visual interest with varying sizes and opacities
          // Particles in center areas are slightly larger and brighter
          const centerX = this.canvas.width / 2;
          const centerY = this.canvas.height / 2;
          const distFromCenter = Math.sqrt(
            Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
          );
          const maxDist = Math.sqrt(
            Math.pow(centerX, 2) + Math.pow(centerY, 2)
          );
          const centerFactor = 1 - (distFromCenter / maxDist) * 0.2; // 0.8 to 1.0
          
          // Vary particle properties for visual interest
          const sizeVariation = 0.9 + (Math.sin(row + col) * 0.5); // 0.9 to 1.4
          const opacityVariation = 0.6 + (Math.cos(row * 0.5 + col * 0.7) * 0.25); // 0.6 to 0.85 (increased base visibility)
          
          this.particles.push({
            x: x,
            y: y,
            originalX: x,
            originalY: y,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            radius: (Math.random() * 1.8 + 1.2) * sizeVariation * centerFactor, // Increased base size
            opacity: opacityVariation * centerFactor // Increased opacity for better visibility
          });
        }
      }
    }
  }

  private initTrailCircles(): void {
    this.trailCircles = [];
    this.trailPositionHistory = [];
    for (let i = 0; i < this.maxTrailCircles; i++) {
      this.trailCircles.push({
        x: -1000,
        y: -1000,
        targetX: -1000,
        targetY: -1000
      });
      this.trailPositionHistory[i] = [];
    }
  }

  private resetParticles(): void {
    this.particles.forEach(p => {
      p.vx = (p.originalX - p.x) * 0.02;
      p.vy = (p.originalY - p.y) * 0.02;
    });
    this.mouse.isActive = false;
    if (this.mouseIdleTimeout) {
      clearTimeout(this.mouseIdleTimeout);
    }
  }

  private setupEventListeners(): void {
    window.addEventListener('resize', this.handleResize.bind(this));
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseenter', this.handleMouseEnter.bind(this));
    document.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    document.addEventListener('focusin', this.handleFocusIn.bind(this));
  }

  private removeEventListeners(): void {
    window.removeEventListener('resize', this.handleResize.bind(this));
    document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
    document.removeEventListener('mouseenter', this.handleMouseEnter.bind(this));
    document.removeEventListener('mouseleave', this.handleMouseLeave.bind(this));
    document.removeEventListener('focusin', this.handleFocusIn.bind(this));
    this.removeAuthCardListeners();
  }

  private setupAuthCardListeners(): void {
    const authCard = document.querySelector('.auth-card');
    if (authCard) {
      authCard.addEventListener('mouseenter', this.handleAuthCardEnter.bind(this));
      authCard.addEventListener('mouseleave', this.handleAuthCardLeave.bind(this));
    }
  }

  private removeAuthCardListeners(): void {
    const authCard = document.querySelector('.auth-card');
    if (authCard) {
      authCard.removeEventListener('mouseenter', this.handleAuthCardEnter.bind(this));
      authCard.removeEventListener('mouseleave', this.handleAuthCardLeave.bind(this));
    }
  }

  private handleAuthCardEnter(): void {
    this.isCursorInAuthCard = true;
    // Capture velocity only for the tip (first circle) to maintain chain structure
    if (this.trailCircles.length > 0) {
      const tip = this.trailCircles[0];
      
      // Calculate velocity more accurately using position history if available
      let vx = 0;
      let vy = 0;
      
      if (this.trailPositionHistory[0] && this.trailPositionHistory[0].length >= 2) {
        // Use recent history to calculate average velocity
        const history = this.trailPositionHistory[0];
        const recent = history.slice(-3); // Last 3 positions
        const now = performance.now();
        
        let totalVx = 0;
        let totalVy = 0;
        let totalTime = 0;
        
        for (let i = 1; i < recent.length; i++) {
          const dt = (recent[i].time - recent[i-1].time) || 16; // Default to 16ms if 0
          if (dt > 0 && dt < 100) { // Only use reasonable time differences
            const dx = recent[i].x - recent[i-1].x;
            const dy = recent[i].y - recent[i-1].y;
            totalVx += dx / dt * 16; // Normalize to 16ms frame time
            totalVy += dy / dt * 16;
            totalTime++;
          }
        }
        
        if (totalTime > 0) {
          vx = (totalVx / totalTime) * 0.8; // Scale down for smoother movement
          vy = (totalVy / totalTime) * 0.8;
        }
      }
      
      // Fallback to interpolation-based velocity if no history
      if (Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1) {
        vx = (tip.targetX - tip.x) * 0.3 * 4; // Reduced scale
        vy = (tip.targetY - tip.y) * 0.3 * 4;
      }
      
      // Clamp velocity to reasonable limits
      const maxVelocity = 3;
      const speed = Math.sqrt(vx * vx + vy * vy);
      if (speed > maxVelocity) {
        vx = (vx / speed) * maxVelocity;
        vy = (vy / speed) * maxVelocity;
      }
      
      // Ensure minimum velocity if too small (prevents trail from being stuck)
      const minVelocity = 0.3;
      if (speed < minVelocity) {
        // Give it a small random initial push if velocity is too low
        const angle = Math.random() * Math.PI * 2;
        vx = Math.cos(angle) * minVelocity;
        vy = Math.sin(angle) * minVelocity;
      }
      
      // Store only one velocity for the tip - rest will follow in chain
      this.trailVelocities = [{ vx, vy }];
    }
  }

  private handleAuthCardLeave(): void {
    this.isCursorInAuthCard = false;
    this.trailVelocities = [];
    this.previousTrailPositions = [];
    // Keep position history for next time
  }

  private handleResize(): void {
    this.resizeCanvas();
    this.createParticles();
    this.initTrailCircles();
    // Clamp cursor position to new viewport bounds
    const clampedX = Math.max(0, Math.min(this.cursorX, window.innerWidth));
    const clampedY = Math.max(0, Math.min(this.cursorY, window.innerHeight));
    if (clampedX !== this.cursorX || clampedY !== this.cursorY) {
      this.cursorX = clampedX;
      this.cursorY = clampedY;
      this.updateGlowCSS();
    }
  }

  private handleMouseEnter(): void {
    if (!this.isCursorInViewport || this.isExiting) {
      this.isCursorInViewport = true;
      this.isExiting = false;
      this.exitVelocity = { vx: 0, vy: 0 };
      
      const currentX = this.mouse.x || window.innerWidth / 2;
      const currentY = this.mouse.y || window.innerHeight / 2;
      
      this.trailCircles.forEach(circle => {
        circle.x = currentX;
        circle.y = currentY;
        circle.targetX = currentX;
        circle.targetY = currentY;
      });
      
      this.lastTrailTipX = currentX;
      this.lastTrailTipY = currentY;
      this.lastTrailTipTime = performance.now();
      
      this.animateTrailOpacity(0, 1);
      this.animateTrailGlowOpacity(0, 1);
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.tagName === 'TEXTAREA' || target.closest('.auth-card')) {
      return;
    }

    if (!this.isCursorInViewport) {
      this.handleMouseEnter();
    }

    const rect = this.canvas.getBoundingClientRect();
    this.mouse.targetX = e.clientX - rect.left;
    this.mouse.targetY = e.clientY - rect.top;
    this.mouse.isActive = true;

    // Update cursor glow - clamp to viewport bounds to prevent overflow
    const now = performance.now();
    this.cursorX = Math.max(0, Math.min(e.clientX, window.innerWidth));
    this.cursorY = Math.max(0, Math.min(e.clientY, window.innerHeight));
    
    if (this.lastMoveTime > 0) {
      const deltaTime = now - this.lastMoveTime;
      const deltaX = this.cursorX - this.lastCursorX;
      const deltaY = this.cursorY - this.lastCursorY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      const instantVelocity = deltaTime > 0 ? (distance / deltaTime) * 1000 : 0;
      
      this.velocityHistory.push(instantVelocity);
      if (this.velocityHistory.length > this.maxVelocityHistory) {
        this.velocityHistory.shift();
      }
      
      const avgVelocity = this.velocityHistory.reduce((a, b) => a + b, 0) / this.velocityHistory.length;
      this.cursorVelocity = avgVelocity;
      
      const maxVelocity = 2000;
      const normalizedVelocity = Math.min(this.cursorVelocity / maxVelocity, 1);
      const curvedVelocity = Math.pow(normalizedVelocity, 0.7);
      const targetIntensity = 0.2 + (curvedVelocity * 0.8);
      
      this.animateGlowIntensity(this.glowIntensity, targetIntensity);
    }
    
    this.lastCursorX = this.cursorX;
    this.lastCursorY = this.cursorY;
    this.lastMoveTime = now;
    this.updateGlowCSS();

    if (this.mouseIdleTimeout) {
      clearTimeout(this.mouseIdleTimeout);
    }

    this.mouseIdleTimeout = setTimeout(() => {
      this.mouse.isActive = false;
      this.cursorVelocity = 0;
      this.velocityHistory = [];
      this.animateGlowIntensity(this.glowIntensity, 0.2);
    }, 10000);
  }
  
  private animateGlowIntensity(from: number, to: number): void {
    const duration = 200;
    const startTime = performance.now();
    const startValue = from;
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 2);
      this.glowIntensity = startValue + (to - startValue) * eased;
      this.updateGlowCSS();
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.glowIntensity = to;
        this.updateGlowCSS();
      }
    };
    
    requestAnimationFrame(animate);
  }

  private updateGlowCSS(): void {
    // Clamp cursor position to viewport bounds to prevent overflow
    const clampedX = Math.max(0, Math.min(this.cursorX, window.innerWidth));
    const clampedY = Math.max(0, Math.min(this.cursorY, window.innerHeight));
    document.documentElement.style.setProperty('--cursor-x', `${clampedX}px`);
    document.documentElement.style.setProperty('--cursor-y', `${clampedY}px`);
    document.documentElement.style.setProperty('--glow-intensity', this.glowIntensity.toString());
  }

  private handleMouseLeave(e: MouseEvent): void {
    this.mouse.isActive = false;
    if (this.mouseIdleTimeout) {
      clearTimeout(this.mouseIdleTimeout);
    }
    
    this.cursorVelocity = 0;
    this.velocityHistory = [];
    this.animateGlowIntensity(this.glowIntensity, 0.2);
    
    // Handle trail exit with smooth glow fade
    if (this.isCursorInViewport && this.trailCircles.length > 0) {
      this.isExiting = true;
      const lastTrailTip = this.trailCircles[0];
      const lastMouseX = this.mouse.x;
      const lastMouseY = this.mouse.y;
      
      const dx = lastMouseX - lastTrailTip.x;
      const dy = lastMouseY - lastTrailTip.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      const baseSpeed = Math.max(this.trailTipVelocity / 800, 2);
      const speed = Math.min(baseSpeed, 8);
      
      if (distance > 0) {
        this.exitVelocity.vx = (dx / distance) * speed;
        this.exitVelocity.vy = (dy / distance) * speed;
      } else {
        const rect = this.canvas.getBoundingClientRect();
        const exitX = e.clientX - rect.left;
        const exitY = e.clientY - rect.top;
        
        if (exitX < 0) {
          this.exitVelocity.vx = -speed;
          this.exitVelocity.vy = 0;
        } else if (exitX > this.canvas.width) {
          this.exitVelocity.vx = speed;
          this.exitVelocity.vy = 0;
        } else if (exitY < 0) {
          this.exitVelocity.vx = 0;
          this.exitVelocity.vy = -speed;
        } else {
          this.exitVelocity.vx = 0;
          this.exitVelocity.vy = speed;
        }
      }
      
      // Fade out trail glow smoothly when exiting
      this.animateTrailGlowOpacity(this.trailGlowOpacity, 0);
      this.isCursorInViewport = false;
    } else {
      this.isCursorInViewport = false;
      this.animateTrailOpacity(this.trailOpacity, 0);
      this.animateTrailGlowOpacity(this.trailGlowOpacity, 0);
    }
  }
  
  private animateTrailOpacity(from: number, to: number): void {
    const duration = 400;
    const startTime = performance.now();
    const startValue = from;
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 2);
      this.trailOpacity = startValue + (to - startValue) * eased;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.trailOpacity = to;
      }
    };
    
    requestAnimationFrame(animate);
  }

  private animateTrailGlowOpacity(from: number, to: number): void {
    this.trailGlowTargetOpacity = to;
    const duration = 400;
    const startTime = performance.now();
    const startValue = from;
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 2);
      this.trailGlowOpacity = startValue + (to - startValue) * eased;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.trailGlowOpacity = to;
      }
    };
    
    requestAnimationFrame(animate);
  }

  private handleFocusIn(e: FocusEvent): void {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON' || target.closest('.auth-card')) {
      this.resetParticles();
      this.mouse.isActive = false;
      if (this.mouseIdleTimeout) {
        clearTimeout(this.mouseIdleTimeout);
      }
    }
  }

  private animate(): void {
    this.update();
    this.draw();
    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  private update(): void {
    // Smooth mouse interpolation
    this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.15;
    this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.15;
    
    // Update trail circles
    if (this.isExiting) {
      this.trailCircles.forEach(circle => {
        circle.x += this.exitVelocity.vx;
        circle.y += this.exitVelocity.vy;
        circle.targetX = circle.x;
        circle.targetY = circle.y;
      });
      
      const firstCircle = this.trailCircles[0];
      const isOutOfBounds = firstCircle.x < -100 || firstCircle.x > this.canvas.width + 100 ||
                           firstCircle.y < -100 || firstCircle.y > this.canvas.height + 100;
      
      if (isOutOfBounds || this.trailOpacity <= 0) {
        this.isExiting = false;
        this.trailOpacity = 0;
        this.trailGlowOpacity = 0;
        this.trailCircles.forEach(circle => {
          circle.x = -1000;
          circle.y = -1000;
          circle.targetX = -1000;
          circle.targetY = -1000;
        });
      } else {
        this.trailOpacity = Math.max(0, this.trailOpacity - 0.05);
      }
    } else if (this.isCursorInViewport) {
      if (this.isCursorInAuthCard) {
        // Continue movement with inertia/momentum when cursor is inside auth card
        // Apply inertia only to the tip, rest follows in chain structure
        if (this.trailCircles.length > 0 && this.trailVelocities.length > 0) {
          const tip = this.trailCircles[0];
          const velocity = this.trailVelocities[0];
          
          // Calculate current speed
          const speed = Math.sqrt(velocity.vx * velocity.vx + velocity.vy * velocity.vy);
          
          // Apply velocity with variable damping (more damping when slower)
          let damping = 0.97;
          if (speed < 1.0) {
            damping = 0.95; // More damping when slow
          } else if (speed < 0.5) {
            damping = 0.93; // Even more damping when very slow
          }
          
          velocity.vx *= damping;
          velocity.vy *= damping;
          
          // Smooth random drift when velocity is very low
          if (speed < 0.5) {
            // Create smooth, organic random movement
            const driftStrength = 0.2;
            const targetVx = (Math.random() - 0.5) * driftStrength;
            const targetVy = (Math.random() - 0.5) * driftStrength;
            
            // Smoothly interpolate towards random target velocity (faster interpolation when very slow)
            const interpolationFactor = speed < 0.2 ? 0.1 : 0.05;
            velocity.vx += (targetVx - velocity.vx) * interpolationFactor;
            velocity.vy += (targetVy - velocity.vy) * interpolationFactor;
            
            // Ensure minimum movement speed
            const currentDriftSpeed = Math.sqrt(velocity.vx * velocity.vx + velocity.vy * velocity.vy);
            if (currentDriftSpeed < 0.2) {
              // If too slow, give it a push
              const angle = Math.atan2(velocity.vy, velocity.vx) || Math.random() * Math.PI * 2;
              velocity.vx = Math.cos(angle) * 0.2;
              velocity.vy = Math.sin(angle) * 0.2;
            }
            
            // Limit drift speed
            if (currentDriftSpeed > 0.8) {
              velocity.vx = (velocity.vx / currentDriftSpeed) * 0.8;
              velocity.vy = (velocity.vy / currentDriftSpeed) * 0.8;
            }
          }
          
          // Update tip position based on velocity
          tip.x += velocity.vx;
          tip.y += velocity.vy;
          
          // Boundary checking - smooth bounce off edges
          if (tip.x < 0) {
            tip.x = 0;
            velocity.vx *= -0.6; // Bounce with energy loss
          } else if (tip.x > this.canvas.width) {
            tip.x = this.canvas.width;
            velocity.vx *= -0.6;
          }
          
          if (tip.y < 0) {
            tip.y = 0;
            velocity.vy *= -0.6;
          } else if (tip.y > this.canvas.height) {
            tip.y = this.canvas.height;
            velocity.vy *= -0.6;
          }
          
          // Update tip target
          tip.targetX = tip.x;
          tip.targetY = tip.y;
          
          // Rest of the trail follows in chain structure with smooth interpolation
          let x = tip.x;
          let y = tip.y;
          
          for (let i = 1; i < this.trailCircles.length; i++) {
            const circle = this.trailCircles[i];
            const prevX = circle.x;
            const prevY = circle.y;
            
            circle.targetX = x;
            circle.targetY = y;
            
            // Smooth interpolation to maintain chain
            circle.x += (circle.targetX - circle.x) * 0.3;
            circle.y += (circle.targetY - circle.y) * 0.3;
            
            x = prevX;
            y = prevY;
          }
        }
      } else {
        // Normal following behavior
        let x = this.mouse.x;
        let y = this.mouse.y;
        
        const now = performance.now();
        
        this.trailCircles.forEach((circle, index) => {
          const prevX = circle.x;
          const prevY = circle.y;
          
          circle.targetX = x;
          circle.targetY = y;
          
          circle.x += (circle.targetX - circle.x) * 0.3;
          circle.y += (circle.targetY - circle.y) * 0.3;
          
          // Track position history for velocity calculation
          if (!this.trailPositionHistory[index]) {
            this.trailPositionHistory[index] = [];
          }
          this.trailPositionHistory[index].push({ x: circle.x, y: circle.y, time: now });
          // Keep only last 5 positions
          if (this.trailPositionHistory[index].length > 5) {
            this.trailPositionHistory[index].shift();
          }
          
          x = prevX;
          y = prevY;
        });
      }
      
      // Calculate trail tip velocity for glow
      if (this.trailCircles.length > 0) {
        const trailTip = this.trailCircles[0];
        const now = performance.now();
        
        if (this.lastTrailTipTime > 0) {
          const deltaTime = now - this.lastTrailTipTime;
          const deltaX = trailTip.x - this.lastTrailTipX;
          const deltaY = trailTip.y - this.lastTrailTipY;
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          
          const instantVelocity = deltaTime > 0 ? (distance / deltaTime) * 1000 : 0;
          
          this.trailTipVelocityHistory.push(instantVelocity);
          if (this.trailTipVelocityHistory.length > this.maxVelocityHistory) {
            this.trailTipVelocityHistory.shift();
          }
          
          const avgVelocity = this.trailTipVelocityHistory.reduce((a, b) => a + b, 0) / this.trailTipVelocityHistory.length;
          this.trailTipVelocity = avgVelocity;
        }
        
        this.lastTrailTipX = trailTip.x;
        this.lastTrailTipY = trailTip.y;
        this.lastTrailTipTime = now;
      }
    }
    
    // Update particles with natural interaction
    this.particles.forEach(particle => {
      if (this.mouse.isActive) {
        const dx = this.mouse.targetX - particle.x;
        const dy = this.mouse.targetY - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 150; // Interaction radius

        if (distance < maxDistance) {
          // Stronger repulsion to break connections nicely
          const force = (maxDistance - distance) / maxDistance;
          const angle = Math.atan2(dy, dx);
          particle.vx -= Math.cos(angle) * force * 1.5;
          particle.vy -= Math.sin(angle) * force * 1.5;
        }
      } else {
        // Slow return to original position - allows connections to reform gradually
        const returnForce = 0.005;
        particle.vx += (particle.originalX - particle.x) * returnForce;
        particle.vy += (particle.originalY - particle.y) * returnForce;
      }

      particle.x += particle.vx;
      particle.y += particle.vy;

      particle.vx *= 0.92;
      particle.vy *= 0.92;

      const maxVelocity = 3;
      const currentSpeed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
      if (currentSpeed > maxVelocity) {
        particle.vx = (particle.vx / currentSpeed) * maxVelocity;
        particle.vy = (particle.vy / currentSpeed) * maxVelocity;
      }

      // Wrap around edges
      if (particle.x < 0) particle.x = this.canvas.width;
      if (particle.x > this.canvas.width) particle.x = 0;
      if (particle.y < 0) particle.y = this.canvas.height;
      if (particle.y > this.canvas.height) particle.y = 0;
    });
  }

  private draw(): void {
    // Clear canvas
    const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
    gradient.addColorStop(0, '#1a202c');
    gradient.addColorStop(0.5, '#2d3748');
    gradient.addColorStop(1, '#1a202c');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw particle connections - create multiple connected components
    // Only check nearby particles for performance
    this.particles.forEach((particle, i) => {
      // Check particles in a reasonable range to form connections
      this.particles.slice(i + 1).forEach(otherParticle => {
        const dx = particle.x - otherParticle.x;
        const dy = particle.y - otherParticle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Connection distance - particles within this form visible structures
        // Longer connection distance to create interconnected network
        const baseConnectionDistance = 110; // Increased for better connectivity
        const connectionDistance = baseConnectionDistance + (Math.random() - 0.5) * 15;
        
        if (distance < connectionDistance) {
          // Calculate opacity based on distance - closer = brighter
          const normalizedDistance = distance / connectionDistance;
          // Use a smoother fade curve for better visibility
          const fadeIn = Math.pow(1 - normalizedDistance, 1.5);
          const opacity = 0.55 * fadeIn; // Increased base opacity for better visibility
          
          this.ctx.beginPath();
          this.ctx.strokeStyle = `rgba(66, 153, 225, ${opacity})`;
          this.ctx.lineWidth = 1;
          this.ctx.moveTo(particle.x, particle.y);
          this.ctx.lineTo(otherParticle.x, otherParticle.y);
          this.ctx.stroke();
        }
      });
    });

    // Draw particles
    this.particles.forEach(particle => {
      this.ctx.beginPath();
      const gradient = this.ctx.createRadialGradient(
        particle.x, particle.y, 0,
        particle.x, particle.y, particle.radius
      );
      gradient.addColorStop(0, `rgba(66, 153, 225, ${particle.opacity})`);
      gradient.addColorStop(1, `rgba(66, 153, 225, 0)`);
      this.ctx.fillStyle = gradient;
      this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // Draw trail
    if (this.trailCircles.length > 1 && (this.isCursorInViewport || this.isExiting) && this.trailOpacity > 0) {
      this.ctx.save();
      this.ctx.globalAlpha = this.trailOpacity;
      
      const path = new Path2D();
      const circles = this.trailCircles;
      const topPoints: { x: number; y: number; opacity: number }[] = [];
      const bottomPoints: { x: number; y: number; opacity: number }[] = [];
      
      for (let i = 0; i < circles.length; i++) {
        const circle = circles[i];
        const progress = (circles.length - 1 - i) / (circles.length - 1);
        const scale = 1 - (progress * 0.7);
        const opacity = 1 - (progress * 0.8);
        const brushWidth = 2 * scale;
        
        let dx = 0;
        let dy = 0;
        
        if (i === 0) {
          const next = circles[i + 1];
          dx = next.x - circle.x;
          dy = next.y - circle.y;
        } else if (i === circles.length - 1) {
          const prev = circles[i - 1];
          dx = circle.x - prev.x;
          dy = circle.y - prev.y;
        } else {
          const prev = circles[i - 1];
          const next = circles[i + 1];
          dx = (next.x - prev.x) / 2;
          dy = (next.y - prev.y) / 2;
        }
        
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length > 0) {
          dx /= length;
          dy /= length;
        }
        
        const perpX = -dy;
        const perpY = dx;
        const halfWidth = brushWidth / 2;
        
        topPoints.push({
          x: circle.x + perpX * halfWidth,
          y: circle.y + perpY * halfWidth,
          opacity: opacity
        });
        bottomPoints.push({
          x: circle.x - perpX * halfWidth,
          y: circle.y - perpY * halfWidth,
          opacity: opacity
        });
      }
      
      path.moveTo(topPoints[0].x, topPoints[0].y);
      
      for (let i = 1; i < topPoints.length; i++) {
        const prev = topPoints[i - 1];
        const curr = topPoints[i];
        const midX = (prev.x + curr.x) / 2;
        const midY = (prev.y + curr.y) / 2;
        path.quadraticCurveTo(prev.x, prev.y, midX, midY);
      }
      
      const lastTop = topPoints[topPoints.length - 1];
      path.lineTo(lastTop.x, lastTop.y);
      
      for (let i = bottomPoints.length - 2; i >= 0; i--) {
        const next = bottomPoints[i + 1];
        const curr = bottomPoints[i];
        const midX = (next.x + curr.x) / 2;
        const midY = (next.y + curr.y) / 2;
        path.quadraticCurveTo(next.x, next.y, midX, midY);
      }
      
      path.closePath();
      
      if (topPoints.length > 0) {
        const cursorPoint = topPoints[0];
        const tailPoint = topPoints[topPoints.length - 1];
        const gradient = this.ctx.createLinearGradient(cursorPoint.x, cursorPoint.y, tailPoint.x, tailPoint.y);
        
        gradient.addColorStop(0, `rgba(66, 153, 225, ${cursorPoint.opacity * 0.8})`);
        if (topPoints.length > 2) {
          const midIndex = Math.floor(topPoints.length / 2);
          const midPoint = topPoints[midIndex];
          const midProgress = midIndex / (topPoints.length - 1);
          gradient.addColorStop(midProgress, `rgba(66, 153, 225, ${midPoint.opacity * 0.5})`);
        }
        gradient.addColorStop(1, `rgba(66, 153, 225, ${tailPoint.opacity * 0.2})`);
        
        this.ctx.fillStyle = gradient;
        this.ctx.fill(path);
      }
      
      this.ctx.restore();
      this.ctx.globalAlpha = 1;
    }

    // Draw trail tip glow - with smooth fade during exit
    // Draw glow if cursor is in viewport OR if exiting (but fade out smoothly)
    if (this.trailCircles.length > 0 && (this.isCursorInViewport || this.isExiting) && this.trailGlowOpacity > 0) {
      const tip = this.trailCircles[0];
      
      // Calculate velocity-based intensity
      const maxVelocity = 2000;
      const normalizedVelocity = Math.min(this.trailTipVelocity / maxVelocity, 1);
      const curvedVelocity = Math.pow(normalizedVelocity, 0.7);
      const velocityIntensity = 0.5 + (curvedVelocity * 0.9);
      const sizeMultiplier = 0.9 + (curvedVelocity * 0.5);
      
      // Apply trail glow opacity (fades out smoothly during exit)
      const effectiveOpacity = this.trailGlowOpacity;
      
      // Outer glow
      const outerRadius = 9 * sizeMultiplier;
      const glowGradient = this.ctx.createRadialGradient(
        tip.x, tip.y, 0,
        tip.x, tip.y, outerRadius
      );
      glowGradient.addColorStop(0, `rgba(66, 153, 225, ${0.7 * velocityIntensity * effectiveOpacity})`);
      glowGradient.addColorStop(0.5, `rgba(66, 153, 225, ${0.45 * velocityIntensity * effectiveOpacity})`);
      glowGradient.addColorStop(1, `rgba(66, 153, 225, 0)`);
      
      this.ctx.fillStyle = glowGradient;
      this.ctx.beginPath();
      this.ctx.arc(tip.x, tip.y, outerRadius, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Inner bright circle
      const innerRadius = 4 * sizeMultiplier;
      const innerGradient = this.ctx.createRadialGradient(
        tip.x, tip.y, 0,
        tip.x, tip.y, innerRadius
      );
      innerGradient.addColorStop(0, `rgba(66, 153, 225, ${1.3 * velocityIntensity * effectiveOpacity})`);
      innerGradient.addColorStop(0.6, `rgba(66, 153, 225, ${0.65 * velocityIntensity * effectiveOpacity})`);
      innerGradient.addColorStop(1, `rgba(66, 153, 225, 0)`);
      
      this.ctx.fillStyle = innerGradient;
      this.ctx.beginPath();
      this.ctx.arc(tip.x, tip.y, innerRadius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  public signup(): void {
    if (!this.form.email || !this.form.password || !this.confirmPassword) {
      this.toastService.showError('All fields are required.');
      return;
    }
    if (this.form.password !== this.confirmPassword) {
      this.toastService.showError('Passwords do not match.');
      return;
    }
    
    this.isLoading = true;
    
    this.authService.signup(this.form)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (response) => {
          this.toastService.showSuccess(response.message);
          this.router.navigate(['/login']);
        },
        error: (err: HttpErrorResponse) => {
          // Use centralized error handler
          handleHttpError(err, this.toastService, 'Signup failed. Please try again.');
        }
      });
  }
}

interface Particle {
  x: number;
  y: number;
  originalX: number;
  originalY: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
}

interface TrailCircle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
}
