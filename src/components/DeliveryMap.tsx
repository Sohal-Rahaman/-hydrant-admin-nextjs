'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, Polyline, InfoWindow, MarkerClusterer } from '@react-google-maps/api';
import styled from 'styled-components';
import { FiMapPin, FiTruck, FiCheckCircle, FiXCircle, FiClock, FiNavigation, FiZap, FiSearch } from 'react-icons/fi';

interface Order {
  id: string;
  userId: string;
  userName?: string;
  customerName?: string;
  customerPhone?: string;
  status: string;
  isPriority?: boolean;
  deliverySlot?: string;
  plusCode?: string;
  deliveryAddress?: {
    latitude?: number;
    longitude?: number;
    fullAddress?: string;
  };
  address?: any;
  raw?: any;
}

interface DeliveryMapProps {
  orders: Order[];
  warehouse: { lat: number; lng: number };
}

const MAP_CONTAINER_STYLE = {
  width: '100%',
  height: '500px',
  borderRadius: '24px',
};

const LIBRARIES: ("geometry" | "drawing")[] = ['geometry', 'drawing'];

const DARK_MAP_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
  { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#3fb618" }] },
  { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#8a8a8a" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
];

export const DeliveryMap = ({ orders, warehouse }: DeliveryMapProps) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'delivered' | 'cancelled'>('pending');
  const [selectedZone, setSelectedZone] = useState<string>('All');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [zoom, setZoom] = useState<number>(13);
  const [searchQuery, setSearchQuery] = useState('');

  const zones = useMemo(() => {
    const z = new Set<string>(['All']);
    orders.forEach(o => {
      if (o.raw?.delivery_zone) z.add(o.raw.delivery_zone);
      // Fallback: guess zone from plus code prefix if possible, or address
    });
    return Array.from(z);
  }, [orders]);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_MAPS_API_KEY || '',
    libraries: LIBRARIES
  });

  const filteredOrders = useMemo(() => {
    let base = orders;
    if (filter === 'pending') {
      base = orders.filter(o => ['pending', 'processing'].includes(o.status?.toLowerCase()));
      
      // Slot priority helper
      const getSlotWeight = (s?: string) => {
        const slot = (s || '').toLowerCase();
        if (slot.includes('morning') || slot.includes('11:00')) return 1;
        if (slot.includes('afternoon') || slot.includes('2:30')) return 2;
        if (slot.includes('evening') || slot.includes('6:00')) return 3;
        return 4;
      };

      base.sort((a, b) => {
        if (a.isPriority && !b.isPriority) return -1;
        if (!a.isPriority && b.isPriority) return 1;
        return getSlotWeight(a.deliverySlot) - getSlotWeight(b.deliverySlot);
      });
    } else if (filter === 'delivered') {
      base = orders.filter(o => o.status?.toLowerCase() === 'completed');
    } else if (filter === 'cancelled') {
      base = orders.filter(o => o.status?.toLowerCase() === 'cancelled');
    }

    if (selectedZone !== 'All') {
      base = base.filter(o => o.raw?.delivery_zone === selectedZone);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      base = base.filter(o => 
        o.raw?.customerId?.toLowerCase().includes(q) || 
        o.plusCode?.toLowerCase().includes(q) ||
        o.userName?.toLowerCase().includes(q)
      );
    }

    return base;
  }, [orders, filter, selectedZone, searchQuery]);

  const pathCoords = useMemo(() => {
    const coords = [warehouse];
    // Only draw path for pending orders
    const pending = filteredOrders.filter(o => 
      ['pending', 'processing'].includes(o.status?.toLowerCase())
    );
    pending.forEach(o => {
      const lat = o.deliveryAddress?.latitude || 
                  o.address?.latitude || 
                  o.raw?.latitude || 
                  o.raw?.location?.latitude ||
                  o.raw?.coords?.latitude ||
                  o.raw?.deliveryAddress?.latitude;
                  
      const lng = o.deliveryAddress?.longitude || 
                  o.address?.longitude || 
                  o.raw?.longitude || 
                  o.raw?.location?.longitude ||
                  o.raw?.coords?.longitude ||
                  o.raw?.deliveryAddress?.longitude;

      if (lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
        coords.push({ lat: Number(lat), lng: Number(lng) });
      }
    });
    return coords;
  }, [filteredOrders, warehouse]);

  const stats = useMemo(() => {
    if (!isLoaded || pathCoords.length < 2) return { distance: 0, fuel: 0 };
    let totalMeters = 0;
    for (let i = 0; i < pathCoords.length - 1; i++) {
      totalMeters += google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(pathCoords[i]),
        new google.maps.LatLng(pathCoords[i+1])
      );
    }
    const km = totalMeters / 1000;
    const fuelRate = 3.5; // Example: 3.5 INR per km
    return {
      distance: km.toFixed(1),
      fuel: (km * fuelRate).toFixed(0)
    };
  }, [isLoaded, pathCoords]);

  const onLoad = useCallback((map: google.maps.Map) => {
    const bounds = new window.google.maps.LatLngBounds(warehouse);
    filteredOrders.forEach(o => {
      const lat = o.deliveryAddress?.latitude || 
                  o.address?.latitude || 
                  o.raw?.latitude || 
                  o.raw?.location?.latitude ||
                  o.raw?.coords?.latitude ||
                  o.raw?.deliveryAddress?.latitude;
                  
      const lng = o.deliveryAddress?.longitude || 
                  o.address?.longitude || 
                  o.raw?.longitude || 
                  o.raw?.location?.longitude ||
                  o.raw?.coords?.longitude ||
                  o.raw?.deliveryAddress?.longitude;

      if (lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
        bounds.extend({ lat: Number(lat), lng: Number(lng) });
      }
    });
    map.fitBounds(bounds, 50);
    setMap(map);
    setZoom(map.getZoom() || 13);
  }, [filteredOrders, warehouse]);

  if (!isLoaded) return <MapPlaceholder>Initializing Smart Logistics Engine...</MapPlaceholder>;

  return (
    <Container>
      <ControlPanel>
        <FilterGroup>
          <FilterBtn $active={filter === 'pending'} onClick={() => setFilter('pending')}>
            <FiClock /> Pending ({orders.filter(o => ['pending','processing'].includes(o.status?.toLowerCase())).length})
          </FilterBtn>
          <FilterBtn $active={filter === 'delivered'} onClick={() => setFilter('delivered')}>
            <FiCheckCircle /> Delivered ({orders.filter(o => o.status?.toLowerCase() === 'completed').length})
          </FilterBtn>
          <FilterBtn $active={filter === 'cancelled'} onClick={() => setFilter('cancelled')}>
            <FiXCircle /> Cancelled ({orders.filter(o => o.status?.toLowerCase() === 'cancelled').length})
          </FilterBtn>
        </FilterGroup>

        <select 
          value={selectedZone} 
          onChange={(e) => setSelectedZone(e.target.value)}
          style={{
            background: 'var(--color-background-primary)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border-primary)',
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: 700,
            outline: 'none'
          }}
        >
          {zones.map(z => <option key={z} value={z}>{z} Zone</option>)}
        </select>

        <StatsGroup>
          <Stat>
            <span className="lbl">Est. Distance</span>
            <span className="val">{stats.distance} KM</span>
          </Stat>
          <Stat>
            <span className="lbl">Est. Fuel Cost</span>
            <span className="val">₹{stats.fuel}</span>
          </Stat>
        </StatsGroup>

        <SearchWrapper>
          <FiSearch size={14} style={{ color: '#666' }} />
          <SearchInput 
            placeholder="Search Customer ID, Name or Plus Code..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </SearchWrapper>
      </ControlPanel>

      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={warehouse}
        zoom={13}
        onLoad={onLoad}
        onZoomChanged={() => {
          if (map) setZoom(map.getZoom() || 13);
        }}
        options={{
          styles: DARK_MAP_STYLE,
          disableDefaultUI: true,
          zoomControl: true,
        }}
      >
        {/* Warehouse */}
        <MarkerF 
          position={warehouse}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#0F6E56',
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: '#fff',
            scale: 10
          }}
          title="WAREHOUSE / PLANT"
        />

        <MarkerClusterer>
          {(clusterer) => (
            <>
              {filteredOrders.map((order, idx) => {
                const lat = order.deliveryAddress?.latitude || 
                            order.address?.latitude || 
                            order.raw?.latitude || 
                            order.raw?.location?.latitude ||
                            order.raw?.coords?.latitude ||
                            order.raw?.deliveryAddress?.latitude;
                            
                const lng = order.deliveryAddress?.longitude || 
                            order.address?.longitude || 
                            order.raw?.longitude || 
                            order.raw?.location?.longitude ||
                            order.raw?.coords?.longitude ||
                            order.raw?.deliveryAddress?.longitude;

                if (!lat || !lng || isNaN(Number(lat)) || isNaN(Number(lng))) return null;
                const pos = { lat: Number(lat), lng: Number(lng) };

                const isSelected = selectedOrder?.id === order.id;
                const showDetailedLabel = zoom >= 16;
                const showSimpleLabel = zoom >= 14 && zoom < 16;
                
                let color = '#94A3B8'; // Pending
                if (order.status === 'completed') color = '#10B981';
                if (order.status === 'cancelled') color = '#EF4444';
                if (order.isPriority && order.status !== 'completed') color = '#F59E0B';
                
                let labelText = '';
                if (showDetailedLabel) {
                   labelText = `${order.raw?.customerId?.slice(-5) || '??'} | ${order.plusCode?.slice(-4) || '??'}`;
                } else if (showSimpleLabel) {
                   labelText = order.raw?.customerId?.slice(-5) || '';
                }

                return (
                  <MarkerF
                    key={order.id}
                    position={pos}
                    clusterer={clusterer}
                    onClick={() => setSelectedOrder(order)}
                    label={labelText ? {
                      text: labelText,
                      color: '#fff',
                      fontSize: showDetailedLabel ? '10px' : '9px',
                      fontWeight: '800',
                      className: 'marker-label'
                    } : (filter === 'pending' ? {
                      text: (idx + 1).toString(),
                      color: '#fff',
                      fontSize: '10px',
                      fontWeight: 'bold'
                    } : undefined)}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      fillColor: color,
                      fillOpacity: 1,
                      strokeWeight: isSelected ? 3 : 1,
                      strokeColor: isSelected ? '#fff' : '#ffffff80',
                      scale: showDetailedLabel ? 24 : (showSimpleLabel ? 18 : 12),
                      labelOrigin: new google.maps.Point(0, 0)
                    }}
                    zIndex={isSelected ? 1000 : idx}
                  />
                );
              })}
            </>
          )}
        </MarkerClusterer>

        {filter === 'pending' && (
          <Polyline
            path={pathCoords}
            options={{
              strokeColor: '#0F6E56',
              strokeOpacity: 0.6,
              strokeWeight: 3,
              icons: [{
                icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW },
                offset: '100%',
                repeat: '80px'
              }]
            }}
          />
        )}

        {selectedOrder && (
          <InfoWindow
            position={{
              lat: Number(selectedOrder.deliveryAddress?.latitude || selectedOrder.raw?.latitude || selectedOrder.raw?.location?.latitude || 0),
              lng: Number(selectedOrder.deliveryAddress?.longitude || selectedOrder.raw?.longitude || selectedOrder.raw?.location?.longitude || 0)
            }}
            onCloseClick={() => setSelectedOrder(null)}
          >
            <InfoWindowContent>
              <h3>{selectedOrder.userName || selectedOrder.customerName}</h3>
              <p className="plus"><FiMapPin size={10}/> {selectedOrder.plusCode || 'No Plus Code'}</p>
              <p className="addr">{selectedOrder.deliveryAddress?.fullAddress || 'Address unavailable'}</p>
              <div className="actions">
                <a href={`tel:${selectedOrder.customerPhone}`} className="act-btn"><FiNavigation size={12}/> Call</a>
                <a 
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedOrder.deliveryAddress?.latitude},${selectedOrder.deliveryAddress?.longitude}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="act-btn primary"
                >
                  <FiNavigation size={12}/> Navigate
                </a>
              </div>
            </InfoWindowContent>
          </InfoWindow>
        )}
      </GoogleMap>
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  
  .marker-label {
    text-shadow: 0 1px 2px rgba(0,0,0,0.8);
    pointer-events: none;
  }
`;

const SearchWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--color-background-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: 12px;
  padding: 0 16px;
  flex: 1;
  min-width: 250px;
  height: 40px;
`;

const SearchInput = styled.input`
  background: none;
  border: none;
  color: var(--color-text-primary);
  font-size: 13px;
  font-family: inherit;
  width: 100%;
  outline: none;
  &::placeholder { color: #666; }
`;

const ControlPanel = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--color-background-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: 16px;
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
`;

const FilterGroup = styled.div`
  display: flex;
  gap: 8px;
`;

const FilterBtn = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  background: ${p => p.$active ? 'var(--color-primary)' : 'transparent'};
  color: ${p => p.$active ? '#fff' : 'var(--color-text-secondary)'};
  border: 1px solid ${p => p.$active ? 'var(--color-primary)' : 'var(--color-border-primary)'};
  &:hover {
    background: ${p => p.$active ? 'var(--color-primary)' : 'rgba(15,110,86,0.1)'};
  }
`;

const StatsGroup = styled.div`
  display: flex;
  gap: 20px;
`;

const Stat = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  .lbl { font-size: 9px; text-transform: uppercase; color: var(--color-text-tertiary); font-weight: 800; letter-spacing: 0.05em; }
  .val { font-size: 14px; font-weight: 800; color: var(--color-primary); }
`;

const InfoWindowContent = styled.div`
  padding: 8px;
  min-width: 180px;
  h3 { margin: 0 0 4px; font-size: 14px; color: #1a1a1a; font-weight: 800; }
  p { margin: 0; font-size: 11px; color: #555; }
  .plus { color: #0F6E56; font-weight: 700; display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
  .addr { color: #888; font-size: 10px; margin-bottom: 12px; }
  .actions { display: flex; gap: 8px; }
  .act-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 800;
    text-decoration: none;
    background: #f0fdf4;
    color: #0F6E56;
    border: 1px solid #0F6E5620;
    &.primary {
      background: #0F6E56;
      color: #fff;
    }
  }
`;

const MapPlaceholder = styled.div`
  width: 100%;
  height: 450px;
  background: var(--color-background-secondary);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-tertiary);
  border: 1px dashed var(--color-border-primary);
`;
