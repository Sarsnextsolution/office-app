import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler
} from "chart.js";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, Filler);

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── Inline SVG Icon ───────────────────────────────────────────────────────────
const Icon = ({ d, size = 15, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const icons = {
  dashboard:  "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  attendance: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  reports:    "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0120 9.414V19a2 2 0 01-2 2z",
  employees:  "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75 M9 11a4 4 0 100-8 4 4 0 000 8z",
  salary:     "M12 2v20M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6",
  leaves:     "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z",
  logout:     "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
  key:        "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4",
  home:       "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  clock:      "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2",
  heart:      "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z",
};

const NavItem = ({ label, page, icon, activePage, setActivePage }) => (
  <li className={activePage === page ? "activeMenu" : ""} onClick={() => setActivePage(page)}>
    <Icon d={icons[icon]} size={15} />
    {label}
  </li>
);

const StatusBadge = ({ loginTime, logoutTime }) => {
  if (!loginTime)  return <span className="status-badge status-absent">● Not Logged</span>;
  if (!logoutTime) return (
    <span className="status-badge status-working">
      <span className="live-dot" /> Working
    </span>
  );
  return <span className="status-badge status-done">✓ Completed</span>;
};

// ══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE SIDE PANEL COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
const EmpSidePanel = ({
  session, loggedUserName, todayAttendance,
  myAttendanceHistory, leaveList, leaveDate, setLeaveDate,
  leaveType, setLeaveType, applyLeave, markLogout,
  calculateTotalHours, calculateLateStats, formatTime,
  historyDate, setHistoryDate, fetchMyAttendanceHistory,
}) => {
  const [activePanel, setActivePanel] = useState("overview");

  const initials = loggedUserName
    ? loggedUserName.charAt(0).toUpperCase()
    : (session?.user?.email?.charAt(0).toUpperCase() || "U");

  const pendingLeaves = leaveList.filter(l => l.status === "pending").length;

  const navBtns = [
    { id: "overview",   label: "Overview",   icon: "home"  },
    { id: "attendance", label: "Attendance", icon: "clock" },
    { id: "leave",      label: "Leave",      icon: "heart" },
  ];

  return (
    <div className="sidePanel">

      {/* Profile */}
      <div className="spProfile">
        <div className="spAvatar">{initials}</div>
        <div>
          <div className="spName">
            {loggedUserName
              ? loggedUserName.charAt(0).toUpperCase() + loggedUserName.slice(1)
              : session?.user?.email}
          </div>
          <div className="spRole">Employee</div>
        </div>
      </div>

      {/* Nav */}
      <div className="spNav">
        {navBtns.map(btn => (
          <button
            key={btn.id}
            className={`spNavBtn${activePanel === btn.id ? " spNavActive" : ""}`}
            onClick={() => setActivePanel(btn.id)}
          >
            <Icon d={icons[btn.icon]} size={15} />
            <span>{btn.label}</span>
            {btn.id === "leave" && pendingLeaves > 0 && <span className="spBadgeDot" />}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="spBody">

        {/* OVERVIEW */}
        {activePanel === "overview" && (
          <div className="spView">
            <div className="spSectionLabel">Today</div>
            <div className="spTodayCard">
              <div className="spTodayDate">
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
              </div>
              <div className="spTodayRow">
                <span className="spTodayLabel">Status</span>
                <StatusBadge loginTime={todayAttendance?.login_time} logoutTime={todayAttendance?.logout_time} />
              </div>
              {todayAttendance?.login_time && (
                <div className="spTodayRow">
                  <span className="spTodayLabel">Login</span>
                  <span className="spTodayVal">{formatTime(todayAttendance.login_time)}</span>
                </div>
              )}
              {!todayAttendance && (
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>Not logged in yet</p>
              )}
              {todayAttendance && !todayAttendance.logout_time && (
                <button className="spActionBtn" onClick={markLogout}>Mark Logout</button>
              )}
              {todayAttendance?.logout_time && (
                <div className="spTodayRow" style={{ marginTop: 8 }}>
                  <span className="spTodayLabel">Logout</span>
                  <span className="spTodayVal">{formatTime(todayAttendance.logout_time)}</span>
                </div>
              )}
            </div>

            <div className="spSectionLabel" style={{ marginTop: 14 }}>This Month</div>
            <div className="spQuickGrid">
              <div className="spQuickBox">
                <div className="spQuickVal">{myAttendanceHistory.filter(a => a.logout_time).length}</div>
                <div className="spQuickLabel">Present</div>
              </div>
              <div className="spQuickBox">
                <div className="spQuickVal" style={{ color: "var(--accent-2)" }}>{calculateTotalHours()}</div>
                <div className="spQuickLabel">Hours</div>
              </div>
              <div className="spQuickBox">
                <div className="spQuickVal" style={{ color: "var(--accent-4)" }}>{calculateLateStats().lateCount}</div>
                <div className="spQuickLabel">Late</div>
              </div>
              <div className="spQuickBox">
                <div className="spQuickVal" style={{ color: "var(--accent-3)" }}>{leaveList.filter(l => l.status === "approved").length}</div>
                <div className="spQuickLabel">Leaves</div>
              </div>
            </div>

            {pendingLeaves > 0 && (
              <>
                <div className="spSectionLabel" style={{ marginTop: 14 }}>Pending Leave</div>
                {leaveList.filter(l => l.status === "pending").map(l => (
                  <div className="spLeaveItem" key={l.id}>
                    <div>
                      <div className="spLeaveDate">{l.leave_date}</div>
                      <div className="spLeaveType">{l.leave_type} leave</div>
                    </div>
                    <span className="spLeaveBadge spBadgeYellow">Pending</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ATTENDANCE */}
        {activePanel === "attendance" && (
          <div className="spView">
            <div className="spSectionLabel">Today's Check-in</div>
            <div className="spTodayCard">
              <div className="spTodayDate">
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
              </div>
              <div className="spTodayRow">
                <span className="spTodayLabel">Status</span>
                <StatusBadge loginTime={todayAttendance?.login_time} logoutTime={todayAttendance?.logout_time} />
              </div>
              {todayAttendance?.login_time && (
                <div className="spTodayRow">
                  <span className="spTodayLabel">Login</span>
                  <span className="spTodayVal">{formatTime(todayAttendance.login_time)}</span>
                </div>
              )}
              {todayAttendance?.logout_time && (
                <div className="spTodayRow">
                  <span className="spTodayLabel">Logout</span>
                  <span className="spTodayVal">{formatTime(todayAttendance.logout_time)}</span>
                </div>
              )}
              {todayAttendance && !todayAttendance.logout_time && (
                <button className="spActionBtn" style={{ marginTop: 12 }} onClick={markLogout}>Mark Logout</button>
              )}
            </div>

            <div className="spSectionLabel" style={{ marginTop: 14 }}>Quick Stats</div>
            <div className="spQuickGrid">
              <div className="spQuickBox">
                <div className="spQuickVal" style={{ color: "var(--accent-3)" }}>{myAttendanceHistory.filter(a => a.logout_time).length}</div>
                <div className="spQuickLabel">Present</div>
              </div>
              <div className="spQuickBox">
                <div className="spQuickVal" style={{ color: "var(--danger)" }}>{myAttendanceHistory.filter(a => !a.login_time).length}</div>
                <div className="spQuickLabel">Absent</div>
              </div>
              <div className="spQuickBox">
                <div className="spQuickVal" style={{ color: "var(--accent-4)" }}>{calculateLateStats().lateCount}</div>
                <div className="spQuickLabel">Late</div>
              </div>
              <div className="spQuickBox">
                <div className="spQuickVal" style={{ color: "var(--accent-2)" }}>{calculateTotalHours()}</div>
                <div className="spQuickLabel">Hours</div>
              </div>
            </div>

            <div className="spSectionLabel" style={{ marginTop: 14 }}>Filter by Date</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                type="date" value={historyDate}
                onChange={e => setHistoryDate(e.target.value)}
                style={{ margin: 0, flex: 1, fontSize: 12, padding: "7px 10px" }}
              />
              <button
                onClick={fetchMyAttendanceHistory}
                style={{ background: "var(--accent)", color: "#fff", padding: "7px 13px", fontSize: 12, borderRadius: 7, border: "none", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}
              >
                Filter
              </button>
            </div>

            <div className="spSectionLabel">Recent History</div>
            <div className="spHistoryTable">
              <table>
                <thead>
                  <tr><th>Date</th><th>In</th><th>Out</th><th></th></tr>
                </thead>
                <tbody>
                  {myAttendanceHistory.slice(0, 10).map(att => (
                    <tr key={att.id}>
                      <td style={{ fontSize: 11 }}>{att.work_date}</td>
                      <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 10.5 }}>
                        {att.login_time ? formatTime(att.login_time).substring(0, 8) : "—"}
                      </td>
                      <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 10.5 }}>
                        {att.logout_time ? formatTime(att.logout_time).substring(0, 8) : "—"}
                      </td>
                      <td><StatusBadge loginTime={att.login_time} logoutTime={att.logout_time} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LEAVE */}
        {activePanel === "leave" && (
          <div className="spView">
            <div className="spSectionLabel">Apply Leave</div>
            <div className="spTodayCard">
              <input
                type="date" value={leaveDate}
                onChange={e => setLeaveDate(e.target.value)}
                style={{ margin: "0 0 8px", fontSize: 12, padding: "8px 10px" }}
              />
              <select
                value={leaveType} onChange={e => setLeaveType(e.target.value)}
                style={{ margin: "0 0 10px", fontSize: 12, padding: "8px 10px" }}
              >
                <option value="sick">Sick Leave</option>
                <option value="casual">Casual Leave</option>
              </select>
              <button className="spActionBtn" onClick={applyLeave}>Apply Leave</button>
            </div>

            <div className="spSectionLabel" style={{ marginTop: 14 }}>Leave Balance</div>
            <div className="spQuickGrid">
              <div className="spQuickBox">
                <div className="spQuickVal" style={{ color: "var(--accent-3)" }}>
                  {6 - leaveList.filter(l => l.leave_type === "sick" && l.status === "approved").length}
                </div>
                <div className="spQuickLabel">Sick Left</div>
              </div>
              <div className="spQuickBox">
                <div className="spQuickVal" style={{ color: "var(--accent-bright)" }}>
                  {6 - leaveList.filter(l => l.leave_type === "casual" && l.status === "approved").length}
                </div>
                <div className="spQuickLabel">Casual Left</div>
              </div>
              <div className="spQuickBox">
                <div className="spQuickVal" style={{ color: "var(--accent-4)" }}>
                  {leaveList.filter(l => l.status === "pending").length}
                </div>
                <div className="spQuickLabel">Pending</div>
              </div>
              <div className="spQuickBox">
                <div className="spQuickVal" style={{ color: "var(--danger)" }}>
                  {leaveList.filter(l => l.status === "rejected").length}
                </div>
                <div className="spQuickLabel">Rejected</div>
              </div>
            </div>

            <div className="spSectionLabel" style={{ marginTop: 14 }}>Leave History</div>
            {leaveList.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>No leave history</p>
            )}
            {leaveList.map(leave => (
              <div className="spLeaveItem" key={leave.id}>
                <div>
                  <div className="spLeaveDate">{leave.leave_date}</div>
                  <div className="spLeaveType" style={{ textTransform: "capitalize" }}>{leave.leave_type} Leave</div>
                </div>
                <span className={`spLeaveBadge ${
                  leave.status === "approved" ? "spBadgeGreen" :
                  leave.status === "rejected" ? "spBadgeRed" : "spBadgeYellow"
                }`}>
                  {leave.status}
                </span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
function App() {
  const [session, setSession]                         = useState(null);
  const [employees, setEmployees]                     = useState([]);
  const [userRole, setUserRole]                       = useState(null);
  const [activePage, setActivePage]                   = useState("dashboard");
  const [name, setName]                               = useState("");
  const [email, setEmail]                             = useState("");
  const [salary, setSalary]                           = useState("");
  const [shiftStart, setShiftStart]                   = useState("");
  const [shiftEnd, setShiftEnd]                       = useState("");
  const [role, setRole]                               = useState("employee");
  const [calls, setCalls]                             = useState("");
  const [leads, setLeads]                             = useState("");
  const [revenue, setRevenue]                         = useState("");
  const [todayAttendance, setTodayAttendance]         = useState(null);
  const [reports, setReports]                         = useState([]);
  const [selectedDate, setSelectedDate]               = useState(new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth]             = useState(new Date().toISOString().slice(0, 7));
  const [monthlyData, setMonthlyData]                 = useState({ totalRevenue: 0, totalDays: 0, avgCalls: 0 });
  const [monthlyReports, setMonthlyReports]           = useState([]);
  const [leaveDate, setLeaveDate]                     = useState("");
  const [leaveType, setLeaveType]                     = useState("sick");
  const [leaveList, setLeaveList]                     = useState([]);
  const [allLeaves, setAllLeaves]                     = useState([]);
  const [salaryData, setSalaryData]                   = useState([]);
  const [showPasswordModal, setShowPasswordModal]     = useState(false);
  const [newPassword, setNewPassword]                 = useState("");
  const [successMessage, setSuccessMessage]           = useState("");
  const [loggedUserName, setLoggedUserName]           = useState("");
  const [myAttendanceHistory, setMyAttendanceHistory] = useState([]);
  const [historyDate, setHistoryDate]                 = useState("");
  const [selectedEmployee, setSelectedEmployee]       = useState(null);
  const [employeeAnalytics, setEmployeeAnalytics]     = useState([]);
  const [workNote, setWorkNote]                       = useState("");
  const [loginEmail, setLoginEmail]                   = useState("");
  const [showForgot, setShowForgot]                   = useState(false);
  const [resetEmail, setResetEmail]                   = useState("");
  const [isResetMode, setIsResetMode]                 = useState(false);
  const [isSending, setIsSending]                     = useState(false);
  const [loginPassword, setLoginPassword]             = useState("");

  const OFFICE_LAT     = 17.368853;
  const OFFICE_LNG     = 78.530211;
  const ALLOWED_RADIUS = 200;

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R  = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a  = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset") === "true") setIsResetMode(true);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session && userRole === "employee") fetchMyAttendanceHistory(); }, [session, userRole]);
  useEffect(() => { if (session) { fetchUserRole(session.user.id); fetchLoggedUserName(session.user.id); } }, [session]);
  useEffect(() => { if (session) checkTodayAttendance(); }, [session]);
  useEffect(() => { if (employees.length > 0) generateSalaryData(); }, [employees, selectedMonth]);
  useEffect(() => { if (session && userRole) { fetchEmployees(); fetchReports(); fetchMonthlySummary(); } }, [session, userRole, selectedDate, selectedMonth]);
  useEffect(() => { if (session && userRole === "employee") fetchLeaves(); }, [session, userRole]);
  useEffect(() => { if (userRole === "director") fetchAllLeaves(); }, [userRole]);
  useEffect(() => {
    if (userRole === "director" && activePage === "salary") generateSalaryData();
    if (userRole === "employee") generateSalaryData();
  }, [activePage, selectedMonth, userRole]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const calculateTotalHours = () => {
    let total = 0;
    myAttendanceHistory.forEach(a => {
      if (a.login_time && a.logout_time)
        total += (new Date(a.logout_time) - new Date(a.login_time)) / 60000;
    });
    return `${Math.floor(total / 60)}h ${Math.floor(total % 60)}m`;
  };

  const calculateLateStats = () => {
    let lateCount = 0, earlyCount = 0;
    myAttendanceHistory.forEach(a => {
      if (!a.login_time || !a.logout_time) return;
      if (new Date(a.login_time)  > new Date(`${a.work_date}T09:00:00`)) lateCount++;
      if (new Date(a.logout_time) < new Date(`${a.work_date}T18:00:00`)) earlyCount++;
    });
    return { lateCount, earlyCount };
  };

  const formatTime = (time) => {
    if (!time) return "—";
    return new Date(time).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
    });
  };

  const capitalize  = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
  const showSuccess = msg => { setSuccessMessage(msg); setTimeout(() => setSuccessMessage(""), 5000); };

  // ── Data fetchers ─────────────────────────────────────────────────────────────
  const fetchEmployees = async () => {
    if (!session) return;
    let q = supabase.from("employees").select("*");
    if (userRole === "employee") q = q.eq("auth_id", session.user.id);
    const { data, error } = await q;
    if (!error) setEmployees(data);
  };

  const fetchEmployeeAnalytics = async empId => {
    const { data, error } = await supabase.from("attendance").select("*")
      .eq("employee_id", empId).order("work_date", { ascending: false });
    if (!error) setEmployeeAnalytics(data || []);
  };

  const fetchUserRole = async userId => {
    const { data } = await supabase.from("employees").select("role").eq("auth_id", userId).maybeSingle();
    setUserRole(data ? data.role : "unknown");
  };

  const fetchLoggedUserName = async userId => {
    const { data } = await supabase.from("employees").select("name").eq("auth_id", userId).single();
    if (data) setLoggedUserName(data.name);
  };

  const fetchReports = async () => {
    const { data, error } = await supabase.from("attendance")
      .select("id, work_date, login_time, logout_time, calls, leads, revenue, work_note, employees(name)")
      .eq("work_date", selectedDate);
    if (!error) setReports(data);
  };

  const fetchMonthlySummary = async () => {
    const startDate = selectedMonth + "-01";
    const lastDay   = new Date(selectedMonth.split("-")[0], selectedMonth.split("-")[1], 0).getDate();
    const endDate   = selectedMonth + "-" + lastDay;
    const { data, error } = await supabase.from("attendance")
      .select("revenue, calls, work_date").gte("work_date", startDate).lte("work_date", endDate);
    if (!error && data) {
      setMonthlyReports(data);
      const totalRevenue = data.reduce((s, r) => s + (r.revenue || 0), 0);
      const totalCalls   = data.reduce((s, r) => s + (r.calls || 0), 0);
      const uniqueDays   = [...new Set(data.map(r => r.work_date))].length;
      setMonthlyData({ totalRevenue, totalDays: uniqueDays, avgCalls: uniqueDays ? Math.round(totalCalls / uniqueDays) : 0 });
    }
  };

  const fetchLeaves = async () => {
    if (!session) return;
    const { data: emp } = await supabase.from("employees").select("id").eq("auth_id", session.user.id).single();
    if (!emp) return;
    const { data } = await supabase.from("leave_requests").select("*")
      .eq("employee_id", emp.id).order("leave_date", { ascending: false });
    setLeaveList(data || []);
  };

  const fetchAllLeaves = async () => {
    const { data, error } = await supabase.from("leave_requests")
      .select("id, leave_date, leave_type, status, employees(name)")
      .order("leave_date", { ascending: false });
    if (!error) setAllLeaves(data || []);
  };

  const fetchMyAttendanceHistory = async () => {
    if (!session) return;
    const { data: emp } = await supabase.from("employees").select("id").eq("auth_id", session.user.id).single();
    if (!emp) return;
    let q = supabase.from("attendance").select("*").eq("employee_id", emp.id).order("work_date", { ascending: false });
    if (historyDate) q = q.eq("work_date", historyDate);
    const { data, error } = await q;
    if (!error) setMyAttendanceHistory(data || []);
  };

  // ── Actions ───────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    if (error) alert(error.message);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); setSession(null); };

  const handleForgotPassword = async () => {
    if (!resetEmail) { alert("Enter your email"); return; }
    setIsSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin + "/?reset=true"
    });
    setIsSending(false);
    if (error) { alert(error.message); } else {
      setShowForgot(false); setResetEmail("");
      showSuccess("Reset link sent. Check your email.");
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword) { alert("Enter new password"); return; }
    const strong = newPassword.length >= 8 && /[0-9]/.test(newPassword) && /[!@#$%^&*]/.test(newPassword);
    if (!strong) { alert("Min 8 chars, include a number & special symbol (!@#$%^&*)"); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { alert(error.message); } else {
      showSuccess("Password updated. Redirecting…");
      setTimeout(async () => { await supabase.auth.signOut(); window.location.href = "/"; }, 2000);
    }
  };

  const addEmployee = async () => {
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password: "Temp@12345" });
    if (signUpError) { alert(signUpError.message); return; }
    if (!data?.user) { alert("User creation failed"); return; }
    const { error } = await supabase.from("employees").insert([{
      name, email, salary, role, auth_id: data.user.id, shift_start: shiftStart, shift_end: shiftEnd
    }]);
    if (error) { alert(error.message); } else {
      showSuccess("Employee Added Successfully");
      setName(""); setEmail(""); setSalary(""); setShiftStart(""); setShiftEnd("");
      fetchEmployees();
    }
  };

  const submitReport = async () => {
    if (!session) return;
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })).toISOString().split("T")[0];
    const { data: emp } = await supabase.from("employees").select("id").eq("auth_id", session.user.id).single();
    if (!emp) { alert("Employee not found"); return; }
    const { error } = await supabase.from("attendance")
      .update({ calls: Number(calls), leads: Number(leads), revenue: Number(revenue), work_note: workNote })
      .eq("employee_id", emp.id).eq("work_date", today);
    if (error) { alert(error.message); } else {
      showSuccess("Report Submitted Successfully");
      setCalls(""); setLeads(""); setRevenue(""); setWorkNote("");
      fetchReports();
    }
  };

  const markLogin = async () => {
    if (!session) return;
    const today = new Date().toISOString().split("T")[0];
    const position = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
    const distance = getDistance(position.coords.latitude, position.coords.longitude, OFFICE_LAT, OFFICE_LNG);
    if (distance > ALLOWED_RADIUS) { alert("❌ You are outside office location. Login not allowed."); return; }
    const { data: emp } = await supabase.from("employees").select("id").eq("auth_id", session.user.id).single();
    if (!emp) { alert("Employee not found"); return; }
    const { data: existing } = await supabase.from("attendance").select("*")
      .eq("employee_id", emp.id).eq("work_date", today).maybeSingle();
    if (existing) { alert("Already logged in today"); setTodayAttendance(existing); return; }
    const { error } = await supabase.from("attendance").insert([{
      employee_id: emp.id, work_date: today, login_time: new Date().toISOString()
    }]);
    if (error) { alert("Login failed: " + error.message); } else { showSuccess("Login marked successfully"); checkTodayAttendance(); }
  };

  const markLogout = async () => {
    if (!session) return;
    const today = new Date().toISOString().split("T")[0];
    const position = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
    const distance = getDistance(position.coords.latitude, position.coords.longitude, OFFICE_LAT, OFFICE_LNG);
    if (distance > ALLOWED_RADIUS) { alert("❌ You are outside office location. Logout not allowed."); return; }
    const { data: emp } = await supabase.from("employees").select("id").eq("auth_id", session.user.id).single();
    if (!emp) { alert("Employee not found"); return; }
    const { error } = await supabase.from("attendance")
      .update({ logout_time: new Date().toISOString() })
      .eq("employee_id", emp.id).eq("work_date", today);
    if (error) { alert("Logout failed: " + error.message); } else { showSuccess("Logout marked successfully"); checkTodayAttendance(); }
  };

  const checkTodayAttendance = async () => {
    if (!session) return;
    const today = new Date().toISOString().split("T")[0];
    const { data: emp } = await supabase.from("employees").select("id").eq("auth_id", session.user.id).single();
    if (!emp) return;
    const { data } = await supabase.from("attendance").select("*")
      .eq("employee_id", emp.id).eq("work_date", today).maybeSingle();
    setTodayAttendance(data);
  };

  const applyLeave = async () => {
    if (!session) return;
    const { data: emp } = await supabase.from("employees").select("id").eq("auth_id", session.user.id).single();
    if (!emp) { alert("Employee not found"); return; }
    const { error } = await supabase.from("leave_requests").insert([{
      employee_id: emp.id, leave_date: leaveDate, leave_type: leaveType, status: "pending"
    }]);
    if (error) { alert(error.message); } else {
      showSuccess("Leave Applied Successfully"); setLeaveDate(""); fetchLeaves();
    }
  };

  const updateLeaveStatus = async (id, newStatus) => {
    const { error } = await supabase.from("leave_requests").update({ status: newStatus }).eq("id", id);
    if (!error) fetchAllLeaves();
  };

  const generateSalaryData = async () => {
    if (!employees.length) return;
    const results = [];
    for (let emp of employees) {
      const breakdown = await calculateFinalSalary(emp, selectedMonth);
      results.push({ ...emp, ...breakdown });
    }
    setSalaryData(results);
  };

  const calculateFinalSalary = async (employee, month) => {
    const year             = month.split("-")[0];
    const monthNumber      = month.split("-")[1];
    const totalDaysInMonth = new Date(year, monthNumber, 0).getDate();
    const dailySalary      = employee.salary / totalDaysInMonth;

    const { data: attendanceData } = await supabase.from("attendance")
      .select("work_date, login_time, logout_time").eq("employee_id", employee.id)
      .gte("work_date", `${month}-01`).lte("work_date", `${month}-${totalDaysInMonth}`);
    const { data: leaveData } = await supabase.from("leave_requests")
      .select("leave_date").eq("employee_id", employee.id).eq("status", "approved")
      .gte("leave_date", `${month}-01`).lte("leave_date", `${month}-${totalDaysInMonth}`);
    const { data: holidayData } = await supabase.from("holidays").select("holidays")
      .gte("holidays", `${month}-01`).lte("holidays", `${month}-${totalDaysInMonth}`);

    const holidayDates    = holidayData?.map(h => h.holidays) || [];
    const attendanceDates = attendanceData?.map(a => a.work_date) || [];
    let lateLoginCount = 0, earlyLogoutCount = 0;

    for (let record of attendanceData || []) {
      if (!record.login_time || !record.logout_time || !employee.shift_start || !employee.shift_end) continue;
      if (new Date(record.login_time)  > new Date(`${record.work_date}T${employee.shift_start}`)) lateLoginCount++;
      if (new Date(record.logout_time) < new Date(`${record.work_date}T${employee.shift_end}`))   earlyLogoutCount++;
    }
    const extraDeduction = (Math.floor(lateLoginCount / 3) + Math.floor(earlyLogoutCount / 3)) * (dailySalary / 2);
    const leaveDates = leaveData?.map(l => l.leave_date) || [];
    let unpaidDays = 0, paidLeaveUsed = false, sundayCount = 0, presentDays = 0;

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const date = `${month}-${String(day).padStart(2, "0")}`;
      if (new Date(date).getDay() === 0) { sundayCount++; continue; }
      if (holidayDates.includes(date)) continue;
      if (attendanceDates.includes(date)) presentDays++;
      if (leaveDates.includes(date)) { if (!paidLeaveUsed) { paidLeaveUsed = true; } else { unpaidDays++; } continue; }
      if (!attendanceDates.includes(date)) unpaidDays++;
    }

    return {
      totalDaysInMonth, sundayCount, festivalCount: holidayDates.length, presentDays,
      approvedLeaveCount: leaveDates.length, unpaidDays, lateLoginCount, earlyLogoutCount,
      dailySalary: Math.round(dailySalary),
      deductionAmount: Math.round(unpaidDays * dailySalary + extraDeduction),
      finalSalary: Math.round(employee.salary - (unpaidDays * dailySalary + extraDeduction))
    };
  };

  const exportToExcel = () => {
    const worksheetData = salaryData.map(emp => ({
      Name: emp.name, "Total Days": emp.totalDaysInMonth, Sundays: emp.sundayCount,
      Festivals: emp.festivalCount, Present: emp.presentDays,
      "Approved Leaves": emp.approvedLeaveCount, "Unpaid Days": emp.unpaidDays,
      "Per Day Salary": emp.dailySalary, Deduction: emp.deductionAmount, "Final Salary": emp.finalSalary
    }));
    const ws = XLSX.utils.json_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payroll");
    saveAs(new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8"
    }), `Payroll-${selectedMonth}.xlsx`);
  };

  const generateSalarySlip = emp => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text("Salary Slip", 80, 15);
    doc.setFontSize(12);
    doc.text("Company: SARS NEXT SOLUTION", 14, 30);
    doc.text(`Month: ${selectedMonth}`, 14, 37);
    doc.text(`Employee: ${emp.name}`, 14, 44);
    autoTable(doc, {
      startY: 55,
      head: [["Description", "Value"]],
      body: [
        ["Total Days", emp.totalDaysInMonth], ["Sundays", emp.sundayCount],
        ["Festivals", emp.festivalCount], ["Present Days", emp.presentDays],
        ["Approved Leaves", emp.approvedLeaveCount], ["Unpaid Days", emp.unpaidDays],
        ["Per Day Salary", `Rs. ${emp.dailySalary}`],
        ["Deduction", `Rs. ${emp.deductionAmount}`],
        ["Final Salary", `Rs. ${emp.finalSalary}`]
      ]
    });
    doc.save(`SalarySlip-${emp.name}-${selectedMonth}.pdf`);
  };

  const chartData = {
    labels: monthlyReports.map(r =>
      new Date(r.work_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    ),
    datasets: [{
      label: "Daily Revenue (₹)",
      data: monthlyReports.map(r => r.revenue || 0),
      borderColor: "#6366f1",
      backgroundColor: ctx => {
        const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 320);
        g.addColorStop(0, "rgba(99,102,241,0.25)");
        g.addColorStop(1, "rgba(99,102,241,0)");
        return g;
      },
      tension: 0.45, fill: true,
      pointBackgroundColor: "#6366f1", pointRadius: 4, pointHoverRadius: 7,
    }]
  };

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0f1117", borderColor: "rgba(99,102,241,0.4)", borderWidth: 1,
        titleColor: "#94a3b8", bodyColor: "#f1f5f9", padding: 12,
        callbacks: { label: c => ` ₹${c.parsed.y.toLocaleString()}` }
      }
    },
    scales: {
      x: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#475569", font: { size: 11 } } },
      y: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#475569", font: { size: 11 }, callback: v => "₹" + v.toLocaleString() } }
    }
  };

  // ── Reset mode ────────────────────────────────────────────────────────────────
  if (isResetMode) {
    return (
      <div className="loginContainer">
        <div className="loginCard">
          <h2>Set New Password</h2>
          <input type="password" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          <small style={{ color: "#6b7280", display: "block", textAlign: "left", marginBottom: 16, fontSize: 12 }}>
            Min 8 chars, include number & special symbol
          </small>
          <button onClick={handlePasswordChange}>Update Password</button>
        </div>
      </div>
    );
  }

  // ── Login ─────────────────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="loginContainer">
        <div className="loginCard">
          {successMessage && (
            <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
              {successMessage}
            </div>
          )}
          <img src="/logo.png" alt="SARS Next Solution" />
          <p>Office Management System</p>
          <input placeholder="Email Address" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
          <input type="password" placeholder="Password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} />
          <p style={{ cursor: "pointer", color: "#818cf8", marginBottom: 4, fontSize: 13, textAlign: "right", textTransform: "none", letterSpacing: "normal", opacity: 1 }}
            onClick={() => setShowForgot(true)}>Forgot Password?</p>
          <button onClick={handleLogin}>Sign In</button>

          {showForgot && (
            <div className="modalOverlay">
              <div className="modalBox">
                <h3>Reset Password</h3>
                <input type="email" placeholder="Registered email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} />
                <div>
                  <button className="btn-ghost" onClick={() => setShowForgot(false)}>Cancel</button>
                  <button onClick={handleForgotPassword} disabled={isSending}>{isSending ? "Sending…" : "Send Reset Link"}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (userRole === null) return <div className="loadingState">Loading workspace…</div>;

  if (userRole === "unknown") {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <h2 style={{ color: "var(--text-primary)", marginBottom: 12 }}>Access Issue</h2>
        <p style={{ marginBottom: 24 }}>Your role wasn't found. Contact your admin.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button onClick={() => setShowPasswordModal(true)}>Change Password</button>
          <button className="btn-ghost" onClick={handleLogout}>Logout</button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="appLayout">

      {/* Director sidebar */}
      {userRole === "director" && (
        <div className="sidebar">
          <div className="logoWrapper">
            <img src="/logo.png" alt="SARS Next Solution" />
          </div>
          <ul>
            {[
              { label: "Dashboard",  page: "dashboard",  icon: "dashboard"  },
              { label: "Attendance", page: "attendance", icon: "attendance" },
              { label: "Reports",    page: "reports",    icon: "reports"    },
              { label: "Employees",  page: "employees",  icon: "employees"  },
              { label: "Salary",     page: "salary",     icon: "salary"     },
              { label: "Leaves",     page: "leaves",     icon: "leaves"     },
            ].map(item => (
              <NavItem key={item.page} {...item} activePage={activePage} setActivePage={setActivePage} />
            ))}
          </ul>
        </div>
      )}

      <div className="mainContent">
        <div className="contentWrapper">

          {/* Header */}
          <div className="header">
            <div>
              <h1>{userRole === "director" ? "Director Dashboard" : "Employee Dashboard"}</h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {userRole === "director" && (
                <p style={{ margin: 0 }}>👋 {capitalize(loggedUserName) || session.user.email}</p>
              )}
              <button className="btn-ghost btn-sm" onClick={() => setShowPasswordModal(true)}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon d={icons.key} size={13} /> Change Password
                </span>
              </button>
              <button className="btn-danger btn-sm" onClick={handleLogout}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon d={icons.logout} size={13} /> Logout
                </span>
              </button>
            </div>
          </div>

          {/* Password modal */}
          {showPasswordModal && (
            <div className="modalOverlay">
              <div className="modalBox">
                <h3>Change Password</h3>
                <input type="password" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                <small>Min 8 chars, include number & special symbol</small>
                <div>
                  <button className="btn-ghost" onClick={() => setShowPasswordModal(false)}>Cancel</button>
                  <button onClick={handlePasswordChange}>Update</button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════ EMPLOYEE LAYOUT ══════════════ */}
          {userRole === "employee" && (
            <div className="empLayout">

              {/* Main content */}
              <div className="empMain">

                {/* Stat cards */}
                <div className="statsRow" style={{ marginBottom: 20 }}>
                  {[
                    { label: "Present Days", value: myAttendanceHistory.filter(a => a.logout_time).length, color: "var(--accent-3)" },
                    { label: "Total Hours",  value: calculateTotalHours(),                                 color: "var(--accent-2)" },
                    { label: "Late Logins",  value: calculateLateStats().lateCount,                        color: "var(--accent-4)" },
                    { label: "Final Salary", value: `₹${salaryData.find(e => e.auth_id === session.user.id)?.finalSalary?.toLocaleString() || "—"}`, color: "var(--accent-3)" },
                  ].map((s, i) => (
                    <div className="statCard" key={i} style={{ animationDelay: `${i * 0.05}s` }}>
                      <h3>{s.label}</h3>
                      <h1 style={{ color: s.color }}>{s.value}</h1>
                    </div>
                  ))}
                </div>

                {/* Mark login */}
                {!todayAttendance && (
                  <div className="card">
                    <h2>Mark Today's Attendance</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
                      You haven't logged in today.
                    </p>
                    <button onClick={markLogin}>Mark Login</button>
                  </div>
                )}

                {/* Daily report */}
                <div className="card">
                  <h2>Submit Daily Report</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 16px" }}>
                    <input type="number" placeholder="Calls"       value={calls}   onChange={e => setCalls(e.target.value)}   />
                    <input type="number" placeholder="Leads"       value={leads}   onChange={e => setLeads(e.target.value)}   />
                    <input type="number" placeholder="Revenue (₹)" value={revenue} onChange={e => setRevenue(e.target.value)} />
                  </div>
                  <textarea placeholder="Work note — what did you accomplish today?" value={workNote} onChange={e => setWorkNote(e.target.value)} />
                  <button onClick={submitReport}>Submit Report</button>
                </div>

                {/* Salary details */}
                <div className="card">
                  <h2>Salary Details</h2>
                  {salaryData.filter(e => e.auth_id === session.user.id).map(emp => (
                    <div key={emp.id}>
                      {[
                        { label: "Base Salary",     val: `₹${Number(emp.salary).toLocaleString()}` },
                        { label: "Present Days",    val: emp.presentDays },
                        { label: "Approved Leaves", val: emp.approvedLeaveCount },
                        { label: "Unpaid Absences", val: emp.unpaidDays,                               bad: true },
                        { label: "Deduction",       val: `₹${emp.deductionAmount?.toLocaleString()}`, bad: true },
                        { label: "Final Salary",    val: `₹${emp.finalSalary?.toLocaleString()}`,     good: true },
                      ].map((row, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
                          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{row.label}</span>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 13, color: row.good ? "var(--accent-3)" : row.bad ? "var(--danger)" : "var(--text-primary)" }}>
                            {row.val}
                          </span>
                        </div>
                      ))}
                      <div style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "center" }}>
                        <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ width: "auto", margin: 0 }} />
                        <button onClick={() => generateSalarySlip(emp)}>Download PDF</button>
                      </div>
                    </div>
                  ))}
                </div>

              </div>{/* /empMain */}

              {/* Side panel */}
              <EmpSidePanel
                session={session}
                loggedUserName={loggedUserName}
                todayAttendance={todayAttendance}
                myAttendanceHistory={myAttendanceHistory}
                leaveList={leaveList}
                leaveDate={leaveDate}     setLeaveDate={setLeaveDate}
                leaveType={leaveType}     setLeaveType={setLeaveType}
                applyLeave={applyLeave}
                markLogout={markLogout}
                calculateTotalHours={calculateTotalHours}
                calculateLateStats={calculateLateStats}
                formatTime={formatTime}
                historyDate={historyDate} setHistoryDate={setHistoryDate}
                fetchMyAttendanceHistory={fetchMyAttendanceHistory}
              />

            </div>
          )}

          {/* ══════════════ DIRECTOR PAGES ══════════════ */}

          {userRole === "director" && activePage === "dashboard" && (
            <div className="dashboardContainer">
              <div className="monthSelector card">
                <h2 style={{ margin: 0 }}>Monthly Overview</h2>
                <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ width: "auto", margin: 0 }} />
              </div>
              <div className="statsRow">
                {[
                  { label: "Total Employees", value: employees.length },
                  { label: "Working Now",     value: reports.filter(r => r.login_time && !r.logout_time).length },
                  { label: "Completed Today", value: reports.filter(r => r.logout_time).length },
                  { label: "Today's Revenue", value: `₹${reports.reduce((s, r) => s + (r.revenue || 0), 0).toLocaleString()}` },
                ].map((s, i) => (
                  <div className="statCard" key={i} style={{ animationDelay: `${i * 0.05}s` }}>
                    <h3>{s.label}</h3><h1>{s.value}</h1>
                  </div>
                ))}
              </div>
              <div className="statsRow">
                {[
                  { label: "Monthly Revenue", value: `₹${monthlyData.totalRevenue.toLocaleString()}` },
                  { label: "Working Days",    value: monthlyData.totalDays },
                  { label: "Avg Calls / Day", value: monthlyData.avgCalls },
                ].map((s, i) => (
                  <div className="statCard" key={i} style={{ animationDelay: `${i * 0.05}s` }}>
                    <h3>{s.label}</h3><h1>{s.value}</h1>
                  </div>
                ))}
              </div>
              {monthlyReports.length > 0 && (
                <div className="card chartCard">
                  <h2>Revenue Trend</h2>
                  <div style={{ height: 340 }}>
                    <Line data={chartData} options={chartOptions} />
                  </div>
                </div>
              )}
            </div>
          )}

          {activePage === "attendance" && userRole === "director" && (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 style={{ margin: 0 }}>Attendance</h2>
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ width: "auto", margin: 0 }} />
              </div>
              <table>
                <thead><tr><th>Name</th><th>Login</th><th>Logout</th><th>Status</th></tr></thead>
                <tbody>
                  {reports.map(rep => (
                    <tr key={rep.id}>
                      <td>{rep.employees?.name}</td>
                      <td style={{ fontFamily: "'DM Mono', monospace" }}>{formatTime(rep.login_time)}</td>
                      <td style={{ fontFamily: "'DM Mono', monospace" }}>{formatTime(rep.logout_time)}</td>
                      <td><StatusBadge loginTime={rep.login_time} logoutTime={rep.logout_time} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activePage === "reports" && userRole === "director" && (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 style={{ margin: 0 }}>Performance Reports</h2>
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ width: "auto", margin: 0 }} />
              </div>
              <table>
                <thead><tr><th>Name</th><th>Date</th><th>Calls</th><th>Leads</th><th>Revenue</th><th>Work Note</th></tr></thead>
                <tbody>
                  {reports.map(rep => (
                    <tr key={rep.id}>
                      <td>{rep.employees?.name}</td>
                      <td>{new Date(rep.work_date).toLocaleDateString()}</td>
                      <td style={{ fontFamily: "'DM Mono', monospace" }}>{rep.calls ?? "—"}</td>
                      <td style={{ fontFamily: "'DM Mono', monospace" }}>{rep.leads ?? "—"}</td>
                      <td style={{ fontFamily: "'DM Mono', monospace", color: "var(--accent-3)" }}>₹{rep.revenue ?? 0}</td>
                      <td style={{ color: "var(--text-muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rep.work_note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activePage === "employees" && userRole === "director" && (
            <>
              <div className="card">
                <h2>Add Employee</h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
                  <input placeholder="Full Name"          value={name}       onChange={e => setName(e.target.value)}       />
                  <input placeholder="Email Address"      value={email}      onChange={e => setEmail(e.target.value)}      />
                  <input placeholder="Monthly Salary (₹)" value={salary}     onChange={e => setSalary(e.target.value)}     />
                  <select value={role} onChange={e => setRole(e.target.value)}>
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="hr">HR</option>
                  </select>
                  <input type="time" value={shiftStart} onChange={e => setShiftStart(e.target.value)} title="Shift Start" />
                  <input type="time" value={shiftEnd}   onChange={e => setShiftEnd(e.target.value)}   title="Shift End"   />
                </div>
                <button onClick={addEmployee}>Add Employee</button>
              </div>

              <div className="card">
                <h2>All Employees</h2>
                <table>
                  <thead><tr><th>Name</th><th>Email</th><th>Base Salary</th><th>Role</th><th>Analytics</th></tr></thead>
                  <tbody>
                    {employees.map(emp => (
                      <tr key={emp.id}>
                        <td>{emp.name}</td>
                        <td style={{ color: "var(--text-muted)", fontSize: 13 }}>{emp.email}</td>
                        <td style={{ fontFamily: "'DM Mono', monospace" }}>₹{Number(emp.salary).toLocaleString()}</td>
                        <td>
                          <span style={{ background: "rgba(99,102,241,0.1)", color: "var(--accent-bright)", padding: "3px 10px", borderRadius: 100, fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>
                            {emp.role}
                          </span>
                        </td>
                        <td>
                          <button className="btn-sm btn-ghost" onClick={() => { setSelectedEmployee(emp); fetchEmployeeAnalytics(emp.id); }}>
                            View Analytics
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedEmployee && (
                <div className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <h2 style={{ margin: 0 }}>{selectedEmployee.name} — Analytics</h2>
                    <button className="btn-ghost btn-sm" onClick={() => setSelectedEmployee(null)}>Close ✕</button>
                  </div>
                  <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
                    {[
                      { label: "Total Days", value: employeeAnalytics.length },
                      { label: "Completed",  value: employeeAnalytics.filter(a => a.logout_time).length },
                      { label: "Working",    value: employeeAnalytics.filter(a => a.login_time && !a.logout_time).length },
                    ].map((s, i) => (
                      <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 20px", minWidth: 120 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 4 }}>{s.label}</div>
                        <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'DM Mono', monospace", color: "var(--text-primary)" }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  <table>
                    <thead><tr><th>Date</th><th>Login</th><th>Logout</th><th>Status</th></tr></thead>
                    <tbody>
                      {employeeAnalytics.map(att => (
                        <tr key={att.id}>
                          <td>{att.work_date}</td>
                          <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 13 }}>{formatTime(att.login_time)}</td>
                          <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 13 }}>{formatTime(att.logout_time)}</td>
                          <td><StatusBadge loginTime={att.login_time} logoutTime={att.logout_time} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {activePage === "leaves" && userRole === "director" && (
            <div className="card">
              <h2>Leave Approvals</h2>
              <table>
                <thead><tr><th>Employee</th><th>Date</th><th>Type</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {allLeaves.map(leave => (
                    <tr key={leave.id}>
                      <td>{leave.employees?.name}</td>
                      <td>{leave.leave_date}</td>
                      <td style={{ textTransform: "capitalize" }}>{leave.leave_type}</td>
                      <td>
                        <span style={{ color: leave.status === "approved" ? "var(--accent-3)" : leave.status === "rejected" ? "var(--danger)" : "var(--accent-4)", fontWeight: 600, textTransform: "capitalize" }}>
                          {leave.status}
                        </span>
                      </td>
                      <td>
                        {leave.status === "pending" && (
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="btn-sm" style={{ background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" }} onClick={() => updateLeaveStatus(leave.id, "approved")}>Approve</button>
                            <button className="btn-sm btn-danger" onClick={() => updateLeaveStatus(leave.id, "rejected")}>Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activePage === "salary" && userRole === "director" && (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 style={{ margin: 0 }}>Salary Breakdown</h2>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ width: "auto", margin: 0 }} />
                  <button onClick={exportToExcel}>Export Excel</button>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr><th>Name</th><th>Days</th><th>Sundays</th><th>Festivals</th><th>Present</th><th>Leaves</th><th>Unpaid</th><th>Per Day</th><th>Deduction</th><th>Late</th><th>Early Exit</th><th>Final Salary</th><th>Slip</th></tr>
                  </thead>
                  <tbody>
                    {salaryData.map(emp => (
                      <tr key={emp.id}>
                        <td>{emp.name}</td>
                        <td>{emp.totalDaysInMonth}</td>
                        <td>{emp.sundayCount}</td>
                        <td>{emp.festivalCount}</td>
                        <td>{emp.presentDays}</td>
                        <td>{emp.approvedLeaveCount}</td>
                        <td style={{ color: emp.unpaidDays > 0 ? "var(--danger)" : "inherit" }}>{emp.unpaidDays}</td>
                        <td style={{ fontFamily: "'DM Mono', monospace" }}>₹{emp.dailySalary}</td>
                        <td style={{ fontFamily: "'DM Mono', monospace", color: "var(--danger)" }}>₹{emp.deductionAmount}</td>
                        <td style={{ color: emp.lateLoginCount   > 0 ? "var(--accent-4)" : "inherit" }}>{emp.lateLoginCount}</td>
                        <td style={{ color: emp.earlyLogoutCount > 0 ? "var(--accent-4)" : "inherit" }}>{emp.earlyLogoutCount}</td>
                        <td><strong style={{ fontFamily: "'DM Mono', monospace", color: "var(--accent-3)", fontSize: 14 }}>₹{emp.finalSalary?.toLocaleString()}</strong></td>
                        <td><button className="btn-sm btn-ghost" onClick={() => generateSalarySlip(emp)}>PDF</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="successPopup">
              <div className="successBox">
                <div className="checkmark">✓</div>
                <p>{successMessage}</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default App;
