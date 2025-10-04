"use client";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function DurationPicker({ onChange }) {
  const [inputToggle, setInputToggle] = useState(true);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);

  const handleMinutesChange = (e) => {
    let value = parseInt(e.target.value) || 0;
    if (value > 59) value = 59; // clamp
    if (value < 0) value = 0;
    setMinutes(value);
    if (onChange) onChange({ minutes: value, seconds });
  };

  const handleSecondsChange = (e) => {
    let value = parseInt(e.target.value) || 0;
    if (value > 59) value = 59; // clamp
    if (value < 0) value = 0;
    setSeconds(value);
    if (onChange) onChange({ minutes, seconds: value });
  };

  return (
    <div className="flex-col items-center justify-center gap-10 bg-gray-900 max-w-sm border-10 border-indigo-100 ">
      <label htmlFor="input-toggle" className="text-sm font-medium mb-1">
        Timed Question?
      </label>
      <Input />
      <input
        id="input-toggle"
        type="checkbox"
        checked={inputToggle}
        onChange={(e) => {
          setInputToggle(e.target.checked);
        }}
        className="w-16 text-center border rounded p-1"
      />

      <div className="flex flex-row gap-2">
        {/* Minutes */}
        <div className="flex flex-col items-center">
          <label htmlFor="minutes" className="text-sm font-medium mb-1">
            Min
          </label>
          <input
            id="minutes"
            type="number"
            value={minutes}
            min={0}
            className="w-16 text-center border rounded p-1"
            onChange={handleMinutesChange}
            disabled={!inputToggle}
          />
        </div>

        <span className="text-lg font-bold mt-5">:</span>

        {/* Seconds */}
        <div className="flex flex-col items-center">
          <label htmlFor="seconds" className="text-sm font-medium mb-1">
            Sec
          </label>
          <input
            id="seconds"
            type="number"
            value={seconds}
            min={0}
            max={59}
            className="w-16 text-center border rounded p-1"
            onChange={handleSecondsChange}
            disabled={!inputToggle}
          />
        </div>
      </div>
    </div>
  );
}
