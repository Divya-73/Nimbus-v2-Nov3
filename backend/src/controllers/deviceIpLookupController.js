import { getDeviceDetailsByIp } from '../queries/deviceIPLookupQueries.js';

export async function getDeviceDetailsByIpController(req, res) {
  try {
    const ip = String(req.query.ip || '').trim();

    if (!ip) {
      return res.status(400).json({
        success: false,
        message: 'IP address is required',
      });
    }

    const device = await getDeviceDetailsByIp(ip);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'No device found for the provided IP address',
      });
    }

    return res.status(200).json({
      success: true,
      data: device,
    });
  } catch (error) {
    console.error('Error fetching device details by IP:', error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}