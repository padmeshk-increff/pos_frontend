import { trigger, transition, style, query, animateChild, group, animate } from '@angular/animations';

export const slideInAnimation = trigger('routeAnimations', [
  transition('* <=> *', [
    // Set a default style for enter and leave
    query(':enter, :leave', [
      style({
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        opacity: 0,
      })
    ], { optional: true }),
    // Animate the new page in
    query(':enter', [
      style({ opacity: 0, transform: 'translateY(20px)' })
    ], { optional: true }),
    query(':leave', animateChild(), { optional: true }),
    group([
      query(':leave', [
        animate('400ms cubic-bezier(0.4, 0.0, 0.2, 1)', style({ opacity: 0, transform: 'translateY(-20px)' }))
      ], { optional: true }),
      query(':enter', [
        animate('400ms cubic-bezier(0.4, 0.0, 0.2, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
      ], { optional: true })
    ]),
    query(':enter', animateChild(), { optional: true }),
  ])
]);

