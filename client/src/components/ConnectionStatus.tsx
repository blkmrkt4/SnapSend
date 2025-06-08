import { useState } from 'react';
import { ChevronDown, Wifi } from 'lucide-react';
import { type Device } from '@shared/schema';

interface ConnectionStatusProps {
  isConnected: boolean;
  devices: Device[];
  currentDevice: Device | null;
}

export function ConnectionStatus({ isConnected, devices, currentDevice }: ConnectionStatusProps) {
  const [showDeviceList, setShowDeviceList] = useState(false);

  const connectedCount = devices.length + (currentDevice ? 1 : 0);

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg p-3 flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-sm font-medium text-gray-700">
            {connectedCount} device{connectedCount !== 1 ? 's' : ''} connected
          </span>
        </div>
        <button 
          className="p-1 hover:bg-gray-100 rounded"
          onClick={() => setShowDeviceList(!showDeviceList)}
        >
          <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${showDeviceList ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {showDeviceList && (
        <div className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Connected Devices</h3>
          <div className="space-y-2">
            {currentDevice && (
              <div className="flex items-center space-x-2 p-2 bg-blue-50 rounded">
                <Wifi className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-blue-900">{currentDevice.name} (You)</span>
              </div>
            )}
            {devices.filter(d => d.id !== currentDevice?.id).map((device) => (
              <div key={`device-${device.id}`} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50">
                <Wifi className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-700">{device.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
