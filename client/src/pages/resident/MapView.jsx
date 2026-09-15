import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, MapPin } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { IncidentTypeIcon } from "../../components/IncidentTypeIcon";
import { StatusBadge } from "../../components/StatusBadge";
import { api } from "../../lib/api";
import { severityColor } from "../../lib/constants";
import { cn } from "../../lib/utils";

// Décale chaque bâtiment autour du point GPS de la résidence (celle-ci n'ayant qu'une
// seule coordonnée pour tous ses bâtiments) selon une spirale de Fibonacci — contrairement
// à une liste fixe de décalages, ça ne se répète jamais, quel que soit le nombre de
// bâtiments (une liste à N entrées réutilisées en modulo faisait se superposer deux
// bâtiments dès qu'il y en avait plus que N).
const GOLDEN_ANGLE = 137.508 * (Math.PI / 180);
const BASE_OFFSET_DEG = 0.0009;
function buildingOffset(index) {
  if (index === 0) return [0, 0];
  const angle = index * GOLDEN_ANGLE;
  const radius = BASE_OFFSET_DEG * Math.sqrt(index);
  return [radius * Math.sin(angle), radius * Math.cos(angle)];
}

export function MapView() {
  const [residence, setResidence] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.get("/residences").then((d) => {
      setResidence(d.residences[0]);
      setBuildings(d.buildings);
    });
    api.get("/incidents").then((d) => setIncidents(d.incidents));
  }, []);

  const buildingsWithPosition = useMemo(() => {
    if (!residence) return [];
    return buildings.map((b, idx) => {
      const [dLat, dLng] = buildingOffset(idx);
      const activeIncidents = incidents.filter((i) => i.building_id === b.id && i.status !== "resolu" && i.status !== "rejete");
      return {
        ...b,
        lat: residence.latitude + dLat,
        lng: residence.longitude + dLng,
        activeCount: activeIncidents.length,
        activeIncidents,
      };
    });
  }, [residence, buildings, incidents]);

  if (!residence) return null;

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold">Carte de la résidence</h1>
        <p className="text-sm text-muted-foreground">{residence.name} · {residence.city}</p>
      </div>

      <div className="h-72 overflow-hidden rounded-xl border border-border card-elevated">
        <MapContainer center={[residence.latitude, residence.longitude]} zoom={17} scrollWheelZoom={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {buildingsWithPosition.map((b) => (
            <CircleMarker
              key={b.id}
              center={[b.lat, b.lng]}
              radius={14}
              pathOptions={{ color: severityColor(b.activeCount), fillColor: severityColor(b.activeCount), fillOpacity: 0.7 }}
              eventHandlers={{ click: () => setExpanded(b.id) }}
            >
              <Popup>
                <strong>{b.name}</strong>
                <br />
                {b.activeCount} incident(s) actif(s)
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#10b981" }} /> OK
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#f59e0b" }} /> En cours
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#ef4444" }} /> Urgent
        </span>
      </div>

      <div className="space-y-3">
        {buildingsWithPosition.map((b) => (
          <div key={b.id} className="overflow-hidden rounded-xl border border-border bg-card card-elevated">
            <button
              onClick={() => setExpanded(expanded === b.id ? null : b.id)}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ background: severityColor(b.activeCount) }} />
                <div>
                  <p className="font-medium">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.floors} étages</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {b.activeCount > 0 && <Badge variant={b.activeCount > 2 ? "urgent" : "in-progress"}>{b.activeCount}</Badge>}
                <ChevronDown className={cn("h-4 w-4 transition-transform", expanded === b.id && "rotate-180")} />
              </div>
            </button>
            <AnimatePresence>
              {expanded === b.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-border"
                >
                  <div className="space-y-2 p-3">
                    {b.activeIncidents.length === 0 && (
                      <p className="py-2 text-center text-xs text-muted-foreground">Aucun incident actif.</p>
                    )}
                    {b.activeIncidents.map((incident) => (
                      <div key={incident.id} className="flex items-center gap-3 rounded-lg bg-muted/50 p-2.5">
                        <IncidentTypeIcon type={incident.type} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{incident.title}</p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" /> {incident.floor && `Étage ${incident.floor}`}
                          </p>
                        </div>
                        <StatusBadge status={incident.status} />
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
