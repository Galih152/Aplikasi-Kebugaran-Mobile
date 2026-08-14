import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/alora.js';

const getEmployeeContext = async (employeeId) => {
  const [empRows] = await pool.query(
    `SELECT e.employee_id, e.full_name, e.employee_code, e.exit_date, e.is_deleted
     FROM mst_employee e
     WHERE e.employee_id = ?`,
    [employeeId]
  );

  return empRows[0] || null;
};

const buildAuthUser = (user, employee) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  username: user.username ?? null,
  role: user.role ?? 'employee',
  employeeId: employee.employee_id,
  employeeName: employee.full_name || user.name,
  employeeCode: employee.employee_code ?? null,
});

const isActiveEmployee = (employee) =>
  employee && employee.is_deleted !== 1 && employee.exit_date == null;

export const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username dan password wajib diisi' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, username, password_hash, role FROM users WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Username atau password salah' });
    }

    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: 'Username atau password salah' });
    }

    const employee = await getEmployeeContext(user.id);
    if (!isActiveEmployee(employee)) {
      return res.status(403).json({ message: 'Akun tidak aktif atau tidak terdaftar sebagai karyawan' });
    }

    const authUser = buildAuthUser(user, employee);
    const token = jwt.sign(authUser, process.env.SESSION_SECRET, { expiresIn: '7d' });

    return res.json({ token, user: authUser });
  } catch (err) {
    console.error('[auth.login]', err.message);
    return res.status(500).json({ message: 'Terjadi kesalahan server saat login' });
  }
};

export const getMe = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, username, role FROM users WHERE id = ?',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    const user = rows[0];
    const employee = await getEmployeeContext(user.id);
    if (!isActiveEmployee(employee)) {
      return res.status(403).json({ message: 'Akun tidak aktif atau tidak terdaftar sebagai karyawan' });
    }

    return res.json({ user: buildAuthUser(user, employee) });
  } catch (err) {
    console.error('[auth.getMe]', err.message);
    return res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

export const logout = async (_req, res) => {
  return res.json({ message: 'Logout berhasil' });
};
