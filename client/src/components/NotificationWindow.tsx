import { Check, X, ExternalLink, Save, Key, Copy } from 'lucide-react';

interface NotificationWindowProps {
  notifications: any[];
  onDismiss: (id: number) => void;
  onOpenFile: (notification: any) => void;
  onSaveFile: (notification: any) => void;
}

export function NotificationWindow({ 
  notifications, 
  onDismiss, 
  onOpenFile, 
  onSaveFile 
}: NotificationWindowProps) {
  const recentNotification = notifications[0];

  if (!recentNotification) {
    return (
      <div className="w-72 space-y-4">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="text-gray-400 w-6 h-6" />
            </div>
            <p className="text-sm text-gray-500">No recent activity</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Today's Activity</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Files transferred</span>
              <span className="text-sm font-medium text-gray-800">0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Clipboard syncs</span>
              <span className="text-sm font-medium text-gray-800">0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Data transferred</span>
              <span className="text-sm font-medium text-gray-800">0 MB</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 space-y-4">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <Check className="text-green-600 w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">{recentNotification.title}</p>
            <p className="text-xs text-gray-500">
              {recentNotification.timestamp?.toLocaleTimeString() || 'Just now'}
            </p>
          </div>
          <button 
            className="p-1 hover:bg-gray-100 rounded"
            onClick={() => onDismiss(recentNotification.id)}
          >
            <X className="text-gray-400 w-3 h-3" />
          </button>
        </div>

        {recentNotification.file && (
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-12 h-8 bg-gray-100 rounded flex items-center justify-center">
              <div className="w-2 h-2 bg-primary rounded" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 truncate">
                {recentNotification.file.originalName}
              </p>
              <p className="text-xs text-gray-500">
                {recentNotification.message}
              </p>
            </div>
          </div>
        )}

        {recentNotification.content && recentNotification.type === 'clipboard' && (
          <div className="bg-gray-50 rounded p-2 mb-3">
            <p className="text-xs text-gray-600 line-clamp-2">
              {recentNotification.content.length > 50 
                ? `${recentNotification.content.substring(0, 50)}...`
                : recentNotification.content
              }
            </p>
          </div>
        )}

        {recentNotification.type === 'connection-request-sent' && recentNotification.connectionKey && (
          <div className="bg-blue-50 rounded p-3 mb-3 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Key className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Share this key:</span>
            </div>
            <div className="flex items-center justify-between bg-white p-2 rounded border">
              <span className="text-2xl font-bold text-blue-900 tracking-wider">
                {recentNotification.connectionKey}
              </span>
              <button
                onClick={() => navigator.clipboard?.writeText(recentNotification.connectionKey)}
                className="p-1 hover:bg-blue-100 rounded"
                title="Copy to clipboard"
              >
                <Copy className="h-4 w-4 text-blue-600" />
              </button>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              The other user needs this key to approve your connection
            </p>
          </div>
        )}

        {/* Show different actions based on notification type */}
        {recentNotification.file ? (
          <div className="flex space-x-2">
            <button 
              className="flex-1 bg-primary text-white py-1.5 px-3 rounded text-xs font-medium hover:bg-primary/90 transition-colors"
              onClick={() => onOpenFile(recentNotification)}
            >
              <ExternalLink className="w-3 h-3 mr-1 inline" />
              Open
            </button>
            <button 
              className="flex-1 bg-gray-100 text-gray-700 py-1.5 px-3 rounded text-xs font-medium hover:bg-gray-200 transition-colors"
              onClick={() => onSaveFile(recentNotification)}
            >
              <Save className="w-3 h-3 mr-1 inline" />
              Save
            </button>
          </div>
        ) : recentNotification.type === 'connection-request-sent' ? (
          <div className="text-center">
            <button 
              className="w-full bg-blue-600 text-white py-1.5 px-3 rounded text-xs font-medium hover:bg-blue-700 transition-colors"
              onClick={() => onDismiss(recentNotification.id)}
            >
              Got it
            </button>
          </div>
        ) : (
          <div className="text-center">
            <button 
              className="w-full bg-gray-100 text-gray-700 py-1.5 px-3 rounded text-xs font-medium hover:bg-gray-200 transition-colors"
              onClick={() => onDismiss(recentNotification.id)}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Today's Activity</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Files transferred</span>
            <span className="text-sm font-medium text-gray-800">
              {notifications.filter(n => n.type === 'file').length}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Clipboard syncs</span>
            <span className="text-sm font-medium text-gray-800">
              {notifications.filter(n => n.type === 'clipboard').length}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Data transferred</span>
            <span className="text-sm font-medium text-gray-800">
              {(notifications.reduce((acc, n) => acc + (n.file?.size || 0), 0) / 1024 / 1024).toFixed(1)} MB
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
