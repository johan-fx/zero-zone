export const centerSummary = {
  name: 'Escuela Norte',
  type: 'Work center',
  missing: ['3 medics', 'Water', 'Light tools'],
  surplus: ['Food', 'Blankets'],
  roles: [
    { label: 'total', value: '12' },
    { label: 'medics', value: '2' },
    { label: 'logistics', value: '4' },
    { label: 'rescue', value: '6' },
  ],
};

export const outboxRows = [
  { title: 'Local signed', detail: 'SOS operation stored on this device.', tone: 'success', status: 'Completed' },
  { title: 'Backend: pending', detail: 'Will sync when network transport is available.', tone: 'pending', status: 'Pending' },
  { title: 'Meshtastic queue', detail: 'Compact critical message queued for gateway.', tone: 'info', status: 'Queued' },
  { title: 'ACK: waiting', detail: 'No acknowledgement received yet.', tone: 'stale', status: 'No ACK' },
] as const;

export const recommendationRows = [
  { title: 'Escuela Norte', detail: 'Medical gap · Water · 900 m', tone: 'success', status: 'Recommended' },
  { title: 'Depot West', detail: 'Water surplus match · data degraded', tone: 'warning', status: 'Confirm first' },
  { title: 'Plaza Sur', detail: 'Saturated for general volunteers', tone: 'risk', status: 'Avoid' },
] as const;
