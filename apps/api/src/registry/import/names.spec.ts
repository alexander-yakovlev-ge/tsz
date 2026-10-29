import { compareNames } from './names';

describe('compareNames', () => {
  it('ignores case, spacing and quote style', () => {
    expect(compareNames('ანა  ბერიძე', 'ანა ბერიძე')).toBe('exact');
    expect(compareNames('შპს "ალფა"', 'შპს „ალფა“')).toBe('exact');
  });

  it('treats swapped words and doubled company prefixes as similar', () => {
    expect(compareNames('სალომე ბოლქვაძე', 'ბოლქვაძე სალომე')).toBe('similar');
    expect(compareNames('შპს შპს "ალფა"', 'შპს "ალფა"')).toBe('similar');
  });

  it('treats a one-letter typo in one word as similar', () => {
    expect(compareNames('ირინა პოპოვი', 'ირინა პოპოვე')).toBe('similar');
    expect(compareNames('ელენე ივანოვი', 'ელენა ივანოვი')).toBe('similar');
  });

  it('keeps family members and different surnames apart', () => {
    expect(compareNames('მაია კოზლოვი', 'ლაშა კოზლოვი')).toBeNull();
    expect(compareNames('მაია ივანოვი', 'მარიამ ივანოვი')).toBeNull();
    expect(compareNames('ლევან სმირნოვი', 'ლევან სემიონოვი')).toBeNull();
    expect(compareNames('ანა ბერიძე', 'ანა ბერიძე ჯუნიორი')).toBeNull();
  });
});
