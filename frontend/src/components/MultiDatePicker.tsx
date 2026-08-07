import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Check, RotateCcw, Calendar as CalendarIcon } from 'lucide-react';

export interface MultiDatePickerProps {
  selectedDates: string[]; // Array of YYYY-MM-DD
  onApply: (dates: string[]) => void;
  onClear: () => void;
  onClose: () => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Helper: Format Date object to YYYY-MM-DD string
function formatDateString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Helper: Format YYYY-MM-DD to human readable string (e.g., "Aug 7, 2026")
export function formatHumanDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MultiDatePicker({
  selectedDates = [],
  onApply,
  onClear,
  onClose,
}: MultiDatePickerProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    if (selectedDates.length > 0) {
      const [y, m] = selectedDates[0].split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date();
  });

  const [tempDates, setTempDates] = useState<string[]>(selectedDates);

  // Sync state if props change
  useEffect(() => {
    setTempDates(selectedDates);
  }, [selectedDates]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Calculate calendar grid days
  const getDaysInMonthGrid = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startingDayOfWeek = firstDayOfMonth.getDay();
    const totalDays = lastDayOfMonth.getDate();

    const grid: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];

    // Prev month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      grid.push({ dateStr: formatDateString(d), dayNum: d.getDate(), isCurrentMonth: false });
    }

    // Current month days
    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month, day);
      grid.push({ dateStr: formatDateString(d), dayNum: day, isCurrentMonth: true });
    }

    // Next month padding
    const remaining = (7 - (grid.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      grid.push({ dateStr: formatDateString(d), dayNum: i, isCurrentMonth: false });
    }

    return grid;
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Toggle day selection
  const handleDayClick = (dateStr: string) => {
    if (tempDates.includes(dateStr)) {
      setTempDates(tempDates.filter((d) => d !== dateStr));
    } else {
      setTempDates([...tempDates, dateStr].sort());
    }
  };

  // Remove single date chip
  const handleRemoveDate = (dateStr: string) => {
    setTempDates(tempDates.filter((d) => d !== dateStr));
  };

  // Presets
  const handlePreset = (presetType: 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth') => {
    const today = new Date();
    const todayStr = formatDateString(today);

    if (presetType === 'today') {
      setTempDates([todayStr]);
    } else if (presetType === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      setTempDates([formatDateString(y)]);
    } else if (presetType === 'last7') {
      const datesArr: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        datesArr.push(formatDateString(d));
      }
      setTempDates(datesArr);
    } else if (presetType === 'last30') {
      const datesArr: string[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        datesArr.push(formatDateString(d));
      }
      setTempDates(datesArr);
    } else if (presetType === 'thisMonth') {
      const year = today.getFullYear();
      const month = today.getMonth();
      const datesArr: string[] = [];
      for (let day = 1; day <= today.getDate(); day++) {
        datesArr.push(formatDateString(new Date(year, month, day)));
      }
      setTempDates(datesArr);
    }
  };

  const handleApply = () => {
    onApply(tempDates);
    onClose();
  };

  const handleClearAll = () => {
    setTempDates([]);
    onClear();
    onClose();
  };

  const gridDays = getDaysInMonthGrid();
  const todayStr = formatDateString(new Date());

  return (
    <div
      ref={popoverRef}
      className="absolute top-full left-0 mt-2 z-50 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-white/10 shadow-2xl p-4 text-xs font-sans text-gray-200 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl"
    >
      {/* Title Header */}
      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2 text-white font-semibold text-xs">
          <CalendarIcon className="w-4 h-4 text-brand-400" />
          <span>Select Multiple Dates</span>
        </div>
        <span className="text-[11px] font-medium bg-brand-500/20 text-brand-300 px-2 py-0.5 rounded-full border border-brand-500/30">
          {tempDates.length} Selected
        </span>
      </div>

      {/* Preset Quick Buttons */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {[
          { id: 'today', label: 'Today' },
          { id: 'yesterday', label: 'Yesterday' },
          { id: 'last7', label: 'Last 7 Days' },
          { id: 'last30', label: 'Last 30 Days' },
          { id: 'thisMonth', label: 'This Month' },
        ].map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handlePreset(p.id as any)}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-brand-500/20 hover:text-brand-300 text-gray-400 border border-white/5 transition-colors text-[11px]"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-3 px-1">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-bold text-white text-sm">
          {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </span>
        <button
          type="button"
          onClick={handleNextMonth}
          className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-1 text-center font-semibold text-gray-500 mb-1 text-[11px]">
        {WEEKDAYS.map((wd) => (
          <div key={wd}>{wd}</div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1 mb-3">
        {gridDays.map(({ dateStr, dayNum, isCurrentMonth }, idx) => {
          const isToday = dateStr === todayStr;
          const isSelected = tempDates.includes(dateStr);

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleDayClick(dateStr)}
              className={`h-8 w-full rounded-lg font-medium text-[11px] flex items-center justify-center transition-all relative ${
                !isCurrentMonth ? 'text-gray-600 opacity-40' : 'text-gray-200'
              } ${
                isSelected
                  ? 'bg-brand-500 text-white font-bold shadow-md shadow-brand-500/30'
                  : 'hover:bg-white/10'
              } ${isToday && !isSelected ? 'border border-brand-500/50 text-brand-400 font-bold' : ''}`}
            >
              {dayNum}
              {isSelected && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-white" />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Dates Chips List */}
      {tempDates.length > 0 && (
        <div className="mb-3 max-h-24 overflow-y-auto pr-1 flex flex-wrap gap-1 bg-white/[0.02] border border-white/5 p-2 rounded-xl">
          {tempDates.map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1 text-[10px] bg-brand-500/20 text-brand-300 border border-brand-500/30 px-2 py-0.5 rounded-lg"
            >
              {formatHumanDate(d)}
              <button
                type="button"
                onClick={() => handleRemoveDate(d)}
                className="hover:text-red-400 transition-colors ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Footer Controls */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10">
        <button
          type="button"
          onClick={handleClearAll}
          className="px-3 py-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors font-medium flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" />
          Clear All
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-brand-600/30 transition-all"
          >
            <Check className="w-3.5 h-3.5" />
            Apply ({tempDates.length})
          </button>
        </div>
      </div>
    </div>
  );
}
