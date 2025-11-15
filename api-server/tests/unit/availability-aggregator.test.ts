import { AvailabilityAggregator } from '../../src/domain/availabilityAggregator';

describe('AvailabilityAggregator', () => {
  const aggregator = new AvailabilityAggregator();

  it('returns zero counts for empty selections', () => {
    const result = aggregator.aggregate([]);
    expect(result.totalSelections).toBe(0);
    expect(result.availableCountBySlotKey.size).toBe(0);
  });

  it('counts single selection', () => {
    const result = aggregator.aggregate([{ participantId: 'p1', slotKey: '2024-03-01#LUNCH' }]);
    expect(result.totalSelections).toBe(1);
    expect(result.availableCountBySlotKey.get('2024-03-01#LUNCH')).toBe(1);
  });

  it('accumulates duplicate slot keys', () => {
    const result = aggregator.aggregate([
      { participantId: 'p1', slotKey: '2024-03-01#LUNCH' },
      { participantId: 'p2', slotKey: '2024-03-01#LUNCH' }
    ]);
    expect(result.availableCountBySlotKey.get('2024-03-01#LUNCH')).toBe(2);
  });

  it('retains slot keys unknown to the template', () => {
    const result = aggregator.aggregate([
      { participantId: 'p1', slotKey: 'mystery-slot' }
    ]);
    expect(result.availableCountBySlotKey.get('mystery-slot')).toBe(1);
  });

  it('handles multiple slots and participants', () => {
    const result = aggregator.aggregate([
      { participantId: 'p1', slotKey: '2024-03-01#LUNCH' },
      { participantId: 'p2', slotKey: '2024-03-02#DINNER' },
      { participantId: 'p3', slotKey: '2024-03-01#LUNCH' },
      { participantId: 'p4', slotKey: '2024-03-03#DINNER' }
    ]);

    expect(result.totalSelections).toBe(4);
    expect(result.availableCountBySlotKey.get('2024-03-01#LUNCH')).toBe(2);
    expect(result.availableCountBySlotKey.get('2024-03-02#DINNER')).toBe(1);
    expect(result.availableCountBySlotKey.get('2024-03-03#DINNER')).toBe(1);
  });
});
