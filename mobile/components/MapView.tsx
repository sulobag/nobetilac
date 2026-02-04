import React, {
  useState,
  useRef,
  useEffect,
  memo,
  forwardRef,
  useImperativeHandle,
} from "react";
import { View, StyleSheet, Platform, Text } from "react-native";
import MapView, { Marker, Region, PROVIDER_GOOGLE } from "react-native-maps";

export interface MapViewComponentRef {
  animateToRegion: (region: Region, duration?: number) => void;
}

interface MapViewComponentProps {
  initialRegion?: Region;
  markers?: {
    id: string;
    latitude: number;
    longitude: number;
    title?: string;
    description?: string;
  }[];
  onRegionChange?: (region: Region) => void;
  onMarkerPress?: (markerId: string) => void;
  showsUserLocation?: boolean;
  followsUserLocation?: boolean;
  centerMarker?: boolean;
  onMapPress?: (coordinate: { latitude: number; longitude: number }) => void;
}

const DEFAULT_REGION: Region = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

const MapViewComponent = forwardRef<MapViewComponentRef, MapViewComponentProps>(
  (
    {
      initialRegion = DEFAULT_REGION,
      markers = [],
      onRegionChange,
      onMarkerPress,
      showsUserLocation = true,
      followsUserLocation = false,
      centerMarker = false,
      onMapPress,
    },
    ref,
  ) => {
    const mapRef = useRef<MapView>(null);
    const [region, setRegion] = useState<Region>(initialRegion);
    const regionChangeTimer = useRef<number | null>(null);

    // Expose animateToRegion method to parent
    useImperativeHandle(ref, () => ({
      animateToRegion: (newRegion: Region, duration: number = 1000) => {
        if (mapRef.current) {
          mapRef.current.animateToRegion(newRegion, duration);
          setRegion(newRegion);
        }
      },
    }));

    useEffect(() => {
      if (followsUserLocation && mapRef.current) {
        mapRef.current.animateToRegion(region, 1000);
      }
    }, [followsUserLocation]);

    // Throttle: Region change'i optimize et
    const handleRegionChangeComplete = (newRegion: Region) => {
      if (regionChangeTimer.current) {
        clearTimeout(regionChangeTimer.current);
      }

      regionChangeTimer.current = setTimeout(() => {
        setRegion(newRegion);
        onRegionChange?.(newRegion);
      }, 300) as unknown as number;
    };

    const handleMarkerPress = (markerId: string) => {
      onMarkerPress?.(markerId);
    };

    return (
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={initialRegion}
          onRegionChangeComplete={handleRegionChangeComplete}
          showsUserLocation={showsUserLocation}
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
          loadingEnabled={true}
          loadingIndicatorColor="#2563eb"
          loadingBackgroundColor="#ffffff"
          moveOnMarkerPress={false}
          pitchEnabled={false}
          rotateEnabled={false}
          scrollEnabled={true}
          zoomEnabled={true}
          minZoomLevel={10}
          maxZoomLevel={18}
          onPress={(e) => onMapPress?.(e.nativeEvent.coordinate)}
        >
          {markers.map((marker) => (
            <Marker
              key={marker.id}
              coordinate={{
                latitude: marker.latitude,
                longitude: marker.longitude,
              }}
              title={marker.title}
              description={marker.description}
              onPress={() => handleMarkerPress(marker.id)}
            />
          ))}
        </MapView>

        {centerMarker && (
          <View style={styles.centerMarker} pointerEvents="none">
            <View style={styles.pinContainer}>
              {/* Pin Body */}
              <View style={styles.pinBody}>
                <View style={styles.pinInner}>
                  <Text style={styles.pinIcon}>📍</Text>
                </View>
              </View>
              {/* Pin Tip */}
              <View style={styles.pinTip} />
            </View>
            {/* Shadow */}
            <View style={styles.pinShadow} />
          </View>
        )}
      </View>
    );
  },
);

MapViewComponent.displayName = "MapViewComponent";

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  centerMarker: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -20,
    marginTop: -60,
    alignItems: "center",
    justifyContent: "flex-end",
    zIndex: 1000,
  },
  pinContainer: {
    alignItems: "center",
    justifyContent: "flex-end",
  },
  pinBody: {
    width: 40,
    height: 50,
    backgroundColor: "#ef4444",
    borderRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    borderWidth: 3,
    borderColor: "#ffffff",
  },
  pinInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  pinIcon: {
    fontSize: 20,
  },
  pinTip: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#ef4444",
    marginTop: -1,
  },
  pinShadow: {
    width: 20,
    height: 6,
    borderRadius: 10,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    marginTop: 4,
  },
});

export default memo(MapViewComponent);
