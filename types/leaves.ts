export 
type Leave = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  type: string;
  status: 'Pending' | 'Approved' | 'Rejected';
};