import { renderComponent } from '../../../../testing/app-testing';
import { RelationSign } from './relation-sign';

describe('RelationSign', () => {
  it('draws < and > as a crocodile whose mouth opens toward the greater side', async () => {
    const { element, fixture } = await renderComponent(RelationSign, { relation: 'gt' });
    expect(element.getAttribute('data-relation')).toBe('gt');
    expect(element.getAttribute('aria-hidden')).toBe('true');
    expect(element.querySelector('.teeth')).not.toBeNull();
    expect(element.querySelector('.eye')).not.toBeNull();
    expect(element.querySelector('.croc')?.getAttribute('transform')).toBeNull();

    fixture.componentRef.setInput('relation', 'lt');
    await fixture.whenStable();
    expect(element.getAttribute('data-relation')).toBe('lt');
    expect(element.querySelector('.croc')?.getAttribute('transform')).toBe('matrix(-1 0 0 1 48 0)');
  });

  it('draws = without the crocodile', async () => {
    const { element } = await renderComponent(RelationSign, { relation: 'eq' });
    expect(element.querySelector('.croc')).toBeNull();
    expect(element.querySelector('.equals')).not.toBeNull();
  });
});
