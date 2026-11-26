import { ChangeDetectionStrategy, Component } from '@angular/core';

let nextId = 0;

@Component({
  selector: 'mu-mascot-thinking',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mascot-thinking.html',
  styleUrl: './mascot-thinking.scss',
})
export class MascotThinking {
  protected readonly furId = `mu-mascot-fur-${nextId++}`;
  protected readonly furRef = `url(#${this.furId})`;
}
