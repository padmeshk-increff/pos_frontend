import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../navbar/navbar';
import { slideInAnimation } from '../../animations/route-animations';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
  animations: [slideInAnimation]
})
export class LayoutComponent {
  // Cursor glow effect removed for performance optimization

  prepareRoute(outlet: RouterOutlet) {
    return outlet?.activatedRouteData?.['animation'];
  }
}