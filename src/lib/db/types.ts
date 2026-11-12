import type {
  AdminSettings,
  AvailabilityPayload,
  BookingRecord,
  BookingStatus,
  BookingType,
  DashboardStats,
  PaymentMethod,
  SlotTier,
  Station,
  StationBlock,
  StationStatus
} from '@/types/booking';

export interface CreateBookingInput {
  bookingType?: BookingType;
  slotTier?: SlotTier;
  customerName: string;
  mobile: string;
  players: number;
  date: string;
  startHour: number;
  duration: number;
  stationChoice: 'auto' | number;
  paymentMethod: PaymentMethod;
  upiRef?: string;
  isAdminManual?: boolean;
  status?: BookingStatus;
  paymentStatus?: string;
  notes?: string;
}

export interface UpdateBookingInput {
  bookingType?: BookingType;
  slotTier?: SlotTier;
  customerName?: string;
  mobile?: string;
  players?: number;
  date?: string;
  startHour?: number;
  duration?: number;
  stationId?: number;
  status?: BookingStatus;
  paymentMethod?: PaymentMethod;
  paymentStatus?: string;
  upiRef?: string;
  notes?: string;
}

export interface CreateBlockInput {
  stationId: number;
  date: string;
  startHour: number;
  endHour: number;
  reason: string;
}

export interface GameZoneRepository {
  readonly mode: 'sqlite' | 'supabase';
  getSettings(): Promise<AdminSettings>;
  updateSettings(patch: Partial<AdminSettings>): Promise<AdminSettings>;
  getStations(): Promise<Station[]>;
  updateStation(id: number, patch: { status?: StationStatus; note?: string; name?: string }): Promise<Station>;
  getAvailability(dateStr: string, duration: number, mode?: BookingType): Promise<AvailabilityPayload>;
  createBooking(input: CreateBookingInput): Promise<BookingRecord>;
  getBookingByCode(bookingCode: string): Promise<BookingRecord | null>;
  listBookings(filters?: { search?: string; date?: string; status?: string }): Promise<BookingRecord[]>;
  updateBooking(id: string, patch: UpdateBookingInput): Promise<BookingRecord>;
  getStats(): Promise<DashboardStats>;
  listBlocks(dateStr?: string): Promise<StationBlock[]>;
  createBlock(input: CreateBlockInput): Promise<StationBlock>;
  deleteBlock(id: string): Promise<void>;
}

