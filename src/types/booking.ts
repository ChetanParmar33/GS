export type StationStatus = 'active' | 'disabled' | 'maintenance';
export type BookingType = 'slot' | 'rental';
export type SlotTier = 'regular' | 'g29';
export type BookingStatus = 'Pending' | 'Confirmed' | 'Cancelled' | 'Completed';
export type PaymentMethod = 'Pay at Shop' | 'UPI Advance' | 'COD' | 'Full Online';

export interface AdminSettings {
  shopName: string;
  address: string;
  contactNumber: string;
  whatsappNumber: string;
  instagramHandle: string;
  instagramUrl: string;
  googleMapsUrl: string;
  openingHour: number;
  closingHour: number;
  hourlyPrice: number;
  regularHourlyPrice: number;
  g29HourlyPrice: number;
  slotPrices: Record<string, number>;
  rentalPrices: Record<string, number>;
  rentalCodFee: number;
  stationCount: number;
  minBookingDate: string;
  maxBookingDate: string;
  closedDates: string[];
  holdPendingSlots: boolean;
  pendingHoldMinutes: number;
  upiEnabled: boolean;
  upiId: string;
  upiAccountName: string;
  upiInstructions: string;
  cancellationRules: string;
}

export interface Station {
  id: number;
  name: string;
  status: StationStatus;
  note: string;
}

export interface StationBlock {
  id: string;
  stationId: number;
  date: string;
  startHour: number;
  endHour: number;
  reason: string;
  createdAt: string;
}

export interface BookingRecord {
  id: string;
  bookingCode: string;
  bookingType: BookingType;
  slotTier: SlotTier;
  customerId: string;
  customerName: string;
  mobile: string;
  players: number;
  stationId: number;
  stationName: string;
  date: string;
  endDate: string;
  startHour: number;
  endHour: number;
  duration: number;
  hourlyPriceSnapshot: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  upiRef: string;
  status: BookingStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface StationSlotView {
  station: Station;
  available: boolean;
  reason: string;
  kind: 'available' | 'booked' | 'blocked' | 'disabled' | 'maintenance';
}

export interface TimeSlotAvailability {
  startHour: number;
  label: string;
  shortLabel: string;
  bookable: boolean;
  reason: string;
  availableCount: number;
  stations: StationSlotView[];
}

export interface AvailabilityPayload {
  mode: BookingType;
  date: string;
  endDate: string;
  duration: number;
  dateBookable: boolean;
  dateReason?: string;
  slots: TimeSlotAvailability[];
  rentalAvailableCount: number;
  rentalStations: StationSlotView[];
}

export interface DashboardStats {
  totalBookings: number;
  todayBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  completedBookings: number;
  todayRevenue: number;
  totalRevenue: number;
}

