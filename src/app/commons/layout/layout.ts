import { Component } from '@angular/core';
import {  RouterOutlet } from '@angular/router'; // 1. Import these
import { NavbarComponent } from '../navbar/navbar';


@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet,NavbarComponent], // 2. Add them to imports
  templateUrl: './layout.html',
  styleUrl: './layout.css'
})
export class LayoutComponent {

}