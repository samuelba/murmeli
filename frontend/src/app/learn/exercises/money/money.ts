import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ExerciseBase } from '../shared/exercise-base';
import { MoneyCompare } from './money-compare';
import { MoneyPay } from './money-pay';
import { MoneyTotal } from './money-total';

export { MAX_TRAY } from './money-pay';

/**
 * Swiss francs and Rappen (or dollars and cents): count the money (total), pay an amount
 * (pay), or say which purse holds more (compare). One component per mode.
 */
@Component({
  selector: 'mu-money-chf',
  imports: [MoneyCompare, MoneyPay, MoneyTotal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex">
      @switch (payload().mode) {
        @case ('total') {
          <mu-money-total
            [payload]="payload()"
            [locked]="locked()"
            [reveal]="reveal()"
            [cue]="cue()"
            (answered)="emit($event)"
          />
        }
        @case ('pay') {
          <mu-money-pay
            [payload]="payload()"
            [locked]="locked()"
            [reveal]="reveal()"
            [cue]="cue()"
            (answered)="emit($event)"
          />
        }
        @case ('compare') {
          <mu-money-compare
            [payload]="payload()"
            [locked]="locked()"
            [reveal]="reveal()"
            [cue]="cue()"
            (answered)="emit($event)"
          />
        }
      }
    </div>
  `,
})
export class Money extends ExerciseBase<'money-chf'> {}
