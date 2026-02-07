import { z } from 'zod';

export const employeeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().min(1, 'Address is required'),
  mobile: z.string()
    .min(1, 'Mobile number is required')
    .regex(/^\d+$/, 'Mobile number must contain only numbers')
    .length(10, 'Mobile number must be exactly 10 digits'),
  nic: z.string()
    .min(1, 'NIC is required')
    .regex(/^([0-9]{9}[x|X|v|V]|[0-9]{12})$/, 'Invalid NIC Format. Expected Old (9 digits + V/X) or New (12 digits)'),
  notes: z.string().optional(),
});
