import ShiftHoursSummary from '../components/ShiftHoursSummary';

export default function ShiftHoursSummaryPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Shift Hours Summary</h1>
        <p className="page-subtitle">Your monthly working-hours overview, quota progress, and shift statistics</p>
      </div>
      <ShiftHoursSummary />
    </div>
  );
}
