import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Kid } from '../../core/api/models';
import { ParentGateService } from '../../core/auth/parent-gate.service';
import { ErrorMessage, errorMessage } from '../../core/errors/error-message';
import { errorCodeOf } from '../../core/http/api-error';
import { KidsService } from '../../core/kids/kids.service';
import { AvatarView } from '../../shared/avatar/avatar';
import { FormError } from '../../shared/form-error/form-error';
import { Icon } from '../../shared/icon/icon';
import { Mascot } from '../../shared/mascot/mascot';
import { PinPad } from '../../shared/pin-pad/pin-pad';
import { Speak } from '../../shared/speak/speak';

export const MAX_KIDS = 8;

@Component({
  selector: 'mu-profile-picker',
  imports: [TranslocoPipe, AvatarView, FormError, Icon, Mascot, PinPad, Speak],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile-picker.html',
  styleUrl: './profile-picker.scss',
})
export class ProfilePicker implements OnInit {
  private readonly kidsService = inject(KidsService);
  private readonly gate = inject(ParentGateService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly pinPad = viewChild(PinPad);
  private readonly pinHeading = viewChild<ElementRef<HTMLElement>>('pinHeading');
  private readonly pickerHeading = viewChild<ElementRef<HTMLElement>>('pickerHeading');

  protected readonly maxKids = MAX_KIDS;
  protected readonly kids = signal<readonly Kid[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<ErrorMessage | null>(null);
  protected readonly selected = signal<Kid | null>(null);
  protected readonly pinError = signal<ErrorMessage | null>(null);
  protected readonly locked = signal(false);
  protected readonly busy = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      this.kids.set(await this.kidsService.list());
    } catch (error) {
      this.loadError.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected async choose(kid: Kid): Promise<void> {
    if (this.busy()) {
      return;
    }
    if (!kid.hasPin) {
      await this.activate(kid);
      return;
    }
    this.selected.set(kid);
    this.pinError.set(null);
    this.locked.set(false);
    this.focus(() => this.pinHeading());
  }

  protected back(): void {
    this.selected.set(null);
    this.pinError.set(null);
    this.locked.set(false);
    this.focus(() => this.pickerHeading());
  }

  protected async onPin(pin: number[]): Promise<void> {
    const kid = this.selected();
    if (kid) {
      await this.activate(kid, pin);
    }
  }

  protected async addProfile(): Promise<void> {
    if (await this.gate.ensure()) {
      await this.router.navigateByUrl('/parent/kids/new');
    }
  }

  protected async openParentArea(): Promise<void> {
    await this.router.navigateByUrl('/parent');
  }

  private async activate(kid: Kid, pin?: number[]): Promise<void> {
    this.busy.set(true);
    this.pinError.set(null);
    try {
      await this.kidsService.activate(kid.id, pin);
      await this.router.navigateByUrl('/learn');
    } catch (error) {
      const code = errorCodeOf(error);
      this.locked.set(code === 'PIN_LOCKED');
      this.pinError.set(code === 'PIN_INVALID' ? { key: 'pin.wrong' } : errorMessage(error));
      this.pinPad()?.reject();
      if (!kid.hasPin) {
        this.loadError.set(errorMessage(error));
      }
    } finally {
      this.busy.set(false);
    }
  }

  private focus(target: () => ElementRef<HTMLElement> | undefined): void {
    afterNextRender(() => target()?.nativeElement.focus(), { injector: this.injector });
  }
}
