import React, { useState, useEffect } from 'react';
import { Plus, X, AlertCircle } from 'lucide-react';
import {
  parseTimeSlots,
  formatTimeSlotsToString,
  formatMinutesToTime,
  parseTimeToMinutes,
  validateTimeRange,
  rangesOverlap,
  mergeOverlappingRanges,
  createEmptyTimeRange
} from '../../utils/timeSlots';

const TimeSlotManager = ({ value, onChange, disabled = false }) => {
  const [timeRanges, setTimeRanges] = useState([]);
  const [errors, setErrors] = useState({});

  // Initialize from value prop
  useEffect(() => {
    if (value && value !== 'Not set') {
      const parsed = parseTimeSlots(value);
      setTimeRanges(parsed.length > 0 ? parsed : [createEmptyTimeRange()]);
    } else {
      setTimeRanges([createEmptyTimeRange()]);
    }
  }, [value]);

  // Update parent when ranges change (only if there are valid ranges)
  useEffect(() => {
    if (timeRanges.length > 0) {
      const validRanges = timeRanges.filter(r => r.start !== null && r.end !== null);
      if (validRanges.length > 0) {
        const formatted = formatTimeSlotsToString(validRanges);
        onChange(formatted);
      } else if (timeRanges.every(r => r.start === null && r.end === null)) {
        // Only update to "Not set" if all ranges are empty
        onChange('Not set');
      }
    }
  }, [timeRanges, onChange]);

  const addTimeRange = () => {
    setTimeRanges([...timeRanges, createEmptyTimeRange()]);
    setErrors({});
  };

  const removeTimeRange = (id) => {
    if (timeRanges.length > 1) {
      setTimeRanges(timeRanges.filter(r => r.id !== id));
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[id];
        return newErrors;
      });
    }
  };

  const updateTimeRange = (id, field, value) => {
    setTimeRanges(timeRanges.map(range => {
      if (range.id === id) {
        const updated = { ...range, [field]: value };
        
        // Validate when both times are set
        if (updated.start !== null && updated.end !== null) {
          const validation = validateTimeRange(updated.start, updated.end);
          if (!validation.valid) {
            setErrors(prev => ({ ...prev, [id]: validation.error }));
          } else {
            // Check for overlaps with other ranges
            const otherRanges = timeRanges.filter(r => r.id !== id && r.start !== null && r.end !== null);
            const hasOverlap = otherRanges.some(other => rangesOverlap(updated, other));
            
            if (hasOverlap) {
              setErrors(prev => ({ ...prev, [id]: 'This time range overlaps with another range' }));
            } else {
              setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[id];
                return newErrors;
              });
            }
          }
        }
        
        return updated;
      }
      return range;
    }));
  };

  const handleTimeChange = (id, field, timeString) => {
    const minutes = parseTimeToMinutes(timeString);
    updateTimeRange(id, field, minutes);
  };

  const handleTimeInputChange = (id, field, timeString) => {
    // Allow partial input (for typing)
    setTimeRanges(timeRanges.map(range => {
      if (range.id === id) {
        return { ...range, [`${field}String`]: timeString };
      }
      return range;
    }));
  };

  const handleTimeInputBlur = (id, field) => {
    const range = timeRanges.find(r => r.id === id);
    const timeString = range?.[`${field}String`] || formatMinutesToTime(range?.[field]);
    if (timeString) {
      handleTimeChange(id, field, timeString);
    }
  };

  // Generate time options for dropdown (every 30 minutes)
  const generateTimeOptions = () => {
    const options = [];
    for (let minutes = 0; minutes < 1440; minutes += 30) {
      options.push({
        value: minutes,
        label: formatMinutesToTime(minutes, false)
      });
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

  return (
    <div className="space-y-3">
      {timeRanges.map((range, index) => {
        const rangeError = errors[range.id];
        const startValue = range.startString !== undefined 
          ? range.startString 
          : (range.start !== null ? formatMinutesToTime(range.start, false) : '');
        const endValue = range.endString !== undefined 
          ? range.endString 
          : (range.end !== null ? formatMinutesToTime(range.end, false) : '');

        return (
          <div key={range.id} className="relative">
            <div className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
              rangeError 
                ? 'border-red-300 bg-red-50' 
                : 'border-gray-200 bg-gray-50 hover:border-gray-300'
            }`}>
              {/* Start Time */}
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Start Time
                </label>
                <select
                  value={range.start !== null ? range.start : ''}
                  onChange={(e) => {
                    const minutes = e.target.value ? parseInt(e.target.value, 10) : null;
                    updateTimeRange(range.id, 'start', minutes);
                  }}
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-sm"
                >
                  <option value="">Select start time</option>
                  {timeOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {/* Allow custom time input as fallback */}
                <input
                  type="text"
                  value={startValue}
                  onChange={(e) => handleTimeInputChange(range.id, 'start', e.target.value)}
                  onBlur={() => handleTimeInputBlur(range.id, 'start')}
                  placeholder="Or type: 9:00 AM"
                  disabled={disabled}
                  className="mt-1 w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-gray-50 text-sm text-gray-600"
                />
              </div>

              {/* Dash */}
              <div className="flex-shrink-0 pt-6 text-gray-500 font-medium">-</div>

              {/* End Time */}
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  End Time
                </label>
                <select
                  value={range.end !== null ? range.end : ''}
                  onChange={(e) => {
                    const minutes = e.target.value ? parseInt(e.target.value, 10) : null;
                    updateTimeRange(range.id, 'end', minutes);
                  }}
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-sm"
                >
                  <option value="">Select end time</option>
                  {timeOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {/* Allow custom time input as fallback */}
                <input
                  type="text"
                  value={endValue}
                  onChange={(e) => handleTimeInputChange(range.id, 'end', e.target.value)}
                  onBlur={() => handleTimeInputBlur(range.id, 'end')}
                  placeholder="Or type: 5:00 PM"
                  disabled={disabled}
                  className="mt-1 w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-gray-50 text-sm text-gray-600"
                />
              </div>

              {/* Remove Button */}
              {timeRanges.length > 1 && !disabled && (
                <button
                  type="button"
                  onClick={() => removeTimeRange(range.id)}
                  className="flex-shrink-0 p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                  title="Remove time slot"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Error Message */}
            {rangeError && (
              <div className="mt-1 flex items-center gap-1 text-xs text-red-600">
                <AlertCircle size={14} />
                <span>{rangeError}</span>
              </div>
            )}

            {/* Helper Text for wrap-around */}
            {range.start !== null && range.end !== null && range.end < range.start && !rangeError && (
              <div className="mt-1 text-xs text-blue-600">
                <span className="font-medium">Note:</span> This time range wraps around to the next day (e.g., 11 PM - 2 AM)
              </div>
            )}
          </div>
        );
      })}

      {/* Add Button */}
      {!disabled && (
        <button
          type="button"
          onClick={addTimeRange}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-teal-500 hover:text-teal-600 hover:bg-teal-50 transition-colors"
        >
          <Plus size={18} />
          <span className="font-medium">Add Another Time Slot</span>
        </button>
      )}

      {/* Help Text */}
      <div className="text-xs text-gray-500 mt-2">
        <p>• You can add multiple time slots</p>
        <p>• Each slot must be at least 30 minutes</p>
        <p>• Time slots can wrap around (e.g., 11 PM - 2 AM)</p>
        <p>• Overlapping ranges are not allowed</p>
      </div>
    </div>
  );
};

export default TimeSlotManager;

