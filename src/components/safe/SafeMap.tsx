import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Zap, AlertTriangle, Users } from 'lucide-react';

export const SafeMap: React.FC = () => {
  const [selectedEmergency, setSelectedEmergency] = useState<string | null>(null);

  const emergencyMarkers = [
    { id: '1', type: 'medical', lat: 37.7749, lng: -122.4194, priority: 'high' },
    { id: '2', type: 'accident', lat: 37.7849, lng: -122.4094, priority: 'medium' },
    { id: '3', type: 'safety', lat: 37.7649, lng: -122.4294, priority: 'high' },
  ];

  const helperMarkers = [
    { id: '1', lat: 37.7729, lng: -122.4174 },
    { id: '2', lat: 37.7789, lng: -122.4134 },
    { id: '3', lat: 37.7669, lng: -122.4254 },
  ];

  return (
    <div className="px-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Emergency Map</h2>
        <Button size="sm" variant="outline">
          <Navigation className="h-4 w-4 mr-1" />
          Center on Me
        </Button>
      </div>

      {/* Mock Map Interface */}
      <Card className="relative h-[300px] bg-gradient-to-br from-blue-50 to-green-50 overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
        
        {/* Mock Street Layout */}
        <div className="absolute inset-4 border-2 border-border rounded-lg bg-card/50">
          <div className="relative h-full">
            {/* Emergency Markers */}
            {emergencyMarkers.map((marker, index) => (
              <button
                key={marker.id}
                onClick={() => setSelectedEmergency(marker.id)}
                className={`absolute w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center ${
                  marker.priority === 'high' ? 'bg-red-500' : 'bg-yellow-500'
                }`}
                style={{
                  top: `${20 + index * 30}%`,
                  left: `${25 + index * 25}%`,
                }}
              >
                <AlertTriangle className="h-3 w-3 text-white" />
              </button>
            ))}

            {/* Helper Markers */}
            {helperMarkers.map((marker, index) => (
              <div
                key={marker.id}
                className="absolute w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"
                style={{
                  top: `${40 + index * 20}%`,
                  left: `${40 + index * 15}%`,
                }}
              />
            ))}

            {/* User Location */}
            <div 
              className="absolute w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-lg"
              style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
            >
              <div className="w-full h-full bg-green-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Map Controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <Button size="sm" variant="outline" className="w-8 h-8 p-0">+</Button>
          <Button size="sm" variant="outline" className="w-8 h-8 p-0">-</Button>
        </div>

        {/* Map Legend */}
        <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg p-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>High Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span>Medium Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>Helpers</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>You</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Map Statistics */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-3 text-center">
          <AlertTriangle className="h-6 w-6 mx-auto mb-1 text-red-500" />
          <div className="text-lg font-semibold text-foreground">3</div>
          <div className="text-xs text-muted-foreground">Active</div>
        </Card>
        <Card className="p-3 text-center">
          <Users className="h-6 w-6 mx-auto mb-1 text-blue-500" />
          <div className="text-lg font-semibold text-foreground">12</div>
          <div className="text-xs text-muted-foreground">Helpers</div>
        </Card>
        <Card className="p-3 text-center">
          <Zap className="h-6 w-6 mx-auto mb-1 text-green-500" />
          <div className="text-lg font-semibold text-foreground">2.3</div>
          <div className="text-xs text-muted-foreground">Avg Response</div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-4">
        <h3 className="font-medium text-foreground mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="justify-start">
            <MapPin className="h-4 w-4 mr-2" />
            Share Location
          </Button>
          <Button variant="outline" className="justify-start">
            <Navigation className="h-4 w-4 mr-2" />
            Navigation
          </Button>
        </div>
      </Card>

      {selectedEmergency && (
        <Card className="p-4 border-l-4 border-l-red-500">
          <h3 className="font-medium text-foreground mb-2">Emergency Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <Badge className="bg-red-100 text-red-800">Medical Emergency</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Distance:</span>
              <span>0.3 miles</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Time:</span>
              <span>5 min ago</span>
            </div>
          </div>
          <Button className="w-full mt-3 bg-blue-600 hover:bg-blue-700">
            Navigate to Emergency
          </Button>
        </Card>
      )}
    </div>
  );
};