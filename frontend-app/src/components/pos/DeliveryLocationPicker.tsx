import { useState, useCallback } from 'react';
import { MapPin, Link2, Navigation, Loader2, AlertTriangle, CheckCircle2, LocateFixed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/utils/calculations';
import api from '@/lib/api';

interface DeliveryInfo {
  customer_lat: number;
  customer_lng: number;
  customer_address: string;
  distance_km: number;
  delivery_fee: number;
}

interface Props {
  onConfirm: (info: DeliveryInfo) => void;
  onClear: () => void;
  currentInfo?: DeliveryInfo | null;
}

/**
 * Parser: ekstrak koordinat dari berbagai format link Google Maps / WhatsApp share location.
 *
 * Format yang didukung:
 *   - https://maps.google.com/?q=-5.123,119.456
 *   - https://www.google.com/maps?q=-5.123,119.456
 *   - https://www.google.com/maps/@-5.123,119.456,15z
 *   - https://maps.app.goo.gl/... (tidak bisa — perlu expand; tampilkan pesan)
 *   - Koordinat mentah: -5.123, 119.456
 */
function parseGoogleMapsLink(input: string): { lat: number; lng: number } | null {
  const trimmed = input.trim();

  // Format koordinat mentah: "-5.123, 119.456" atau "-5.123 119.456"
  const rawCoord = trimmed.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
  if (rawCoord) {
    const lat = parseFloat(rawCoord[1]);
    const lng = parseFloat(rawCoord[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // ?q=lat,lng
  const qParam = trimmed.match(/[?&]q=(-?\d+\.?\d*)[,+](-?\d+\.?\d*)/);
  if (qParam) return { lat: parseFloat(qParam[1]), lng: parseFloat(qParam[2]) };

  // @lat,lng,...z (maps/@...)
  const atParam = trimmed.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atParam) return { lat: parseFloat(atParam[1]), lng: parseFloat(atParam[2]) };

  // place?ll=lat,lng
  const llParam = trimmed.match(/[?&]ll=(-?\d+\.?\d*)[,](-?\d+\.?\d*)/);
  if (llParam) return { lat: parseFloat(llParam[1]), lng: parseFloat(llParam[2]) };

  return null;
}

export function DeliveryLocationPicker({ onConfirm, onClear, currentInfo }: Props) {
  const [tab, setTab] = useState<'link' | 'manual'>('link');
  const [linkInput, setLinkInput] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [addressNote, setAddressNote] = useState('');
  const [parsedCoords, setParsedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [parseError, setParseError] = useState('');
  const [loading, setLoading] = useState(false);
  const [calcResult, setCalcResult] = useState<{
    distance_km: number;
    delivery_fee: number;
    exceeds_max?: boolean;
    message?: string;
  } | null>(null);
  const [calcError, setCalcError] = useState('');
  const [overrideFee, setOverrideFee] = useState('');

  const handleLinkParse = () => {
    setParseError('');
    setCalcResult(null);
    setCalcError('');

    // Deteksi short URL
    if (linkInput.includes('maps.app.goo.gl') || linkInput.includes('goo.gl')) {
      setParseError(
        'Link pendek (goo.gl) tidak bisa di-parse langsung. Buka link tersebut di browser/HP, lalu copy URL lengkap dari address bar dan paste di sini.'
      );
      return;
    }

    const coords = parseGoogleMapsLink(linkInput);
    if (!coords) {
      setParseError(
        'Koordinat tidak ditemukan. Pastikan link mengandung koordinat (contoh: maps.google.com/?q=-5.12,119.45) atau masukkan koordinat manual.'
      );
      return;
    }
    setParsedCoords(coords);
    calculateFee(coords.lat, coords.lng);
  };

  const handleManualSubmit = () => {
    setCalcResult(null);
    setCalcError('');
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setCalcError('Koordinat tidak valid. Latitude: -90 s/d 90, Longitude: -180 s/d 180');
      return;
    }
    setParsedCoords({ lat, lng });
    calculateFee(lat, lng);
  };

  const calculateFee = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    setCalcError('');
    try {
      const res = await api.post('/delivery/calculate', {
        customer_lat: lat,
        customer_lng: lng,
      });
      setCalcResult(res.data);
      setOverrideFee(String(res.data.delivery_fee));
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.exceeds_max) {
        setCalcResult({ ...data, exceeds_max: true });
        setCalcError(data.message);
      } else {
        setCalcError(data?.message || 'Gagal menghitung ongkir. Cek konfigurasi koordinat toko.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleConfirm = () => {
    if (!parsedCoords || !calcResult) return;
    const fee = parseInt(overrideFee) || calcResult.delivery_fee;
    onConfirm({
      customer_lat: parsedCoords.lat,
      customer_lng: parsedCoords.lng,
      customer_address: addressNote,
      distance_km: calcResult.distance_km,
      delivery_fee: fee,
    });
  };

  const mapEmbedUrl = parsedCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${parsedCoords.lng - 0.01},${parsedCoords.lat - 0.01},${parsedCoords.lng + 0.01},${parsedCoords.lat + 0.01}&layer=mapnik&marker=${parsedCoords.lat},${parsedCoords.lng}`
    : null;

  // Tampilan ringkas jika sudah dikonfirmasi
  if (currentInfo) {
    return (
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
            <MapPin className="w-4 h-4" />
            Lokasi Delivery Terkonfirmasi
          </div>
          <button
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Ubah
          </button>
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          {currentInfo.customer_address && (
            <p>📍 {currentInfo.customer_address}</p>
          )}
          <p>🛣️ Jarak: <span className="text-foreground font-medium">{currentInfo.distance_km} km</span></p>
          <p>🚗 Ongkir: <span className="text-green-400 font-bold">{formatCurrency(currentInfo.delivery_fee)}</span></p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <Navigation className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <p className="font-semibold text-sm">Lokasi Pelanggan</p>
          <p className="text-xs text-muted-foreground">Untuk menghitung ongkos kirim otomatis</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex rounded-lg bg-secondary/50 p-1 gap-1">
        <button
          onClick={() => { setTab('link'); setParseError(''); setCalcError(''); }}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md font-medium transition-all ${
            tab === 'link'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          Paste Link WA
        </button>
        <button
          onClick={() => { setTab('manual'); setParseError(''); setCalcError(''); }}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md font-medium transition-all ${
            tab === 'manual'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <LocateFixed className="w-3.5 h-3.5" />
          Input Manual
        </button>
      </div>

      {/* Tab: Paste Link */}
      {tab === 'link' && (
        <div className="space-y-3">
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-300 space-y-1">
            <p className="font-medium">📱 Cara share lokasi via WhatsApp:</p>
            <ol className="list-decimal ml-4 space-y-0.5 text-blue-200/80">
              <li>Buka chat WA pelanggan</li>
              <li>Klik 📎 → Lokasi → Bagikan Lokasi Langsung</li>
              <li>Copy link Google Maps yang dikirim</li>
              <li>Paste di kotak di bawah ini</li>
            </ol>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Link Google Maps / Koordinat</Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://maps.google.com/?q=-5.12,119.45 atau -5.12, 119.45"
                value={linkInput}
                onChange={e => { setLinkInput(e.target.value); setParseError(''); }}
                className="text-xs font-mono"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleLinkParse}
                disabled={!linkInput.trim() || loading}
                className="shrink-0"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cari'}
              </Button>
            </div>
            {parseError && (
              <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{parseError}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Manual */}
      {tab === 'manual' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Latitude</Label>
              <Input
                placeholder="-5.1234"
                value={manualLat}
                onChange={e => setManualLat(e.target.value)}
                className="text-xs font-mono"
                type="number"
                step="0.000001"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Longitude</Label>
              <Input
                placeholder="119.4567"
                value={manualLng}
                onChange={e => setManualLng(e.target.value)}
                className="text-xs font-mono"
                type="number"
                step="0.000001"
              />
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleManualSubmit}
            disabled={!manualLat || !manualLng || loading}
            className="w-full"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Navigation className="w-4 h-4 mr-2" />}
            Hitung Ongkir
          </Button>
        </div>
      )}

      {/* Map Preview */}
      {parsedCoords && mapEmbedUrl && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span className="text-xs font-medium text-green-400">
              Koordinat: {parsedCoords.lat.toFixed(6)}, {parsedCoords.lng.toFixed(6)}
            </span>
          </div>
          <div className="rounded-lg overflow-hidden border border-border h-40">
            <iframe
              src={mapEmbedUrl}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              title="Lokasi Pelanggan"
            />
          </div>
        </div>
      )}

      {/* Calc Error */}
      {calcError && (
        <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{calcError}</span>
        </div>
      )}

      {/* Result Panel */}
      {calcResult && !calcResult.exceeds_max && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-green-400">Estimasi Ongkir</span>
            <span className="text-xs text-muted-foreground">{calcResult.distance_km} km</span>
          </div>

          {/* Fee Override */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ongkir (bisa diubah manual)</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">Rp</span>
              <Input
                type="number"
                min="0"
                value={overrideFee}
                onChange={e => setOverrideFee(e.target.value)}
                className="text-sm font-bold text-green-400 bg-green-500/10 border-green-500/30 h-8"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Kalkulasi otomatis: {formatCurrency(calcResult.delivery_fee)}
            </p>
          </div>

          {/* Alamat Note */}
          <div className="space-y-1.5">
            <Label className="text-xs">Keterangan Alamat (opsional)</Label>
            <Input
              placeholder="Contoh: Blok A No.5, dekat warung..."
              value={addressNote}
              onChange={e => setAddressNote(e.target.value)}
              className="text-xs"
            />
          </div>

          {/* Confirm Button */}
          <Button
            type="button"
            onClick={handleConfirm}
            className="w-full bg-green-600 hover:bg-green-700 text-white h-9"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Konfirmasi Lokasi & Ongkir
          </Button>
        </div>
      )}
    </div>
  );
}
