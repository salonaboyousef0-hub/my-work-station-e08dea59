-- Allow notifications originating from the Booking app
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'booking';
