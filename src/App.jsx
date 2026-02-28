import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
);

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function App() {
  const [session, setSession] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [userRole, setUserRole] = useState(null);
const [activePage, setActivePage] = useState("dashboard");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [salary, setSalary] = useState("");
  const [shiftStart, setShiftStart] = useState("");
const [shiftEnd, setShiftEnd] = useState("");
  const [role, setRole] = useState("employee");
  const [calls, setCalls] = useState("");
  const [leads, setLeads] = useState("");
  const [revenue, setRevenue] = useState("");
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [reports, setReports] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const [monthlyData, setMonthlyData] = useState({
    totalRevenue: 0,
    totalDays: 0,
    avgCalls: 0
  });
  const [monthlyReports, setMonthlyReports] = useState([]);
const [leaveDate, setLeaveDate] = useState("");
const [leaveType, setLeaveType] = useState("sick");
const [leaveList, setLeaveList] = useState([]);
const [allLeaves, setAllLeaves] = useState([]);
const [salaryData, setSalaryData] = useState([]);
const [showPasswordModal, setShowPasswordModal] = useState(false);
const [newPassword, setNewPassword] = useState("");
const [successMessage, setSuccessMessage] = useState("");
const [loggedUserName, setLoggedUserName] = useState("");


  const [workNote, setWorkNote] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [showForgot, setShowForgot] = useState(false);
const [resetEmail, setResetEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  // 🔒 Office Location Restriction
const OFFICE_LAT = 17.368853;
const OFFICE_LNG = 78.530211;
const ALLOWED_RADIUS = 200; // meters

const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) *
      Math.cos(φ2) *
      Math.sin(Δλ / 2) *
      Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

  // Restore session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
  const hash = window.location.hash;

  if (hash && hash.includes("access_token")) {
    setShowPasswordModal(true);
  }
}, []);

  // Fetch employees after login
  useEffect(() => {
    if (session) {
      fetchUserRole(session.user.id);
      fetchLoggedUserName(session.user.id);
    }
  }, [session]);
  useEffect(() => {
    if (session) {
      checkTodayAttendance();
    }
  }, [session]);
useEffect(() => {
  if (employees.length > 0) {
    generateSalaryData();
  }
}, [employees, selectedMonth]);
  useEffect(() => {
    if (session && userRole) {
      fetchEmployees();
      fetchReports();
      fetchMonthlySummary();
    }
  }, [session, userRole, selectedDate, selectedMonth]);
useEffect(() => {
  if (session && userRole === "employee") {
    fetchLeaves();
  }
}, [session, userRole]);
useEffect(() => {
  if (userRole === "director") {
    fetchAllLeaves();
  }
}, [userRole]);
useEffect(() => {
  if (userRole === "director" && activePage === "salary") {
    generateSalaryData();
  }

  if (userRole === "employee") {
    generateSalaryData();
  }
}, [activePage, selectedMonth, userRole]);




  const fetchEmployees = async () => {
    if (!session) return;

    let query = supabase.from("employees").select("*");

    // Employee ayithe own data matrame
    if (userRole === "employee") {
      query = query.eq("auth_id", session.user.id);
    }

    const { data, error } = await query;

    if (!error) setEmployees(data);
  };

  const fetchUserRole = async (userId) => {
    const { data, error } = await supabase
      .from("employees")
      .select("role")
      .eq("auth_id", userId)
      .maybeSingle();

    if (data) {
      setUserRole(data.role);
    } else {
      setUserRole("unknown");
    }
  };
  const fetchLoggedUserName = async (userId) => {
  const { data, error } = await supabase
    .from("employees")
    .select("name")
    .eq("auth_id", userId)
    .single();

  if (data) {
    setLoggedUserName(data.name);
  }
};
const generateSalaryData = async () => {
  if (!employees.length) return;

  const results = [];

  for (let emp of employees) {
    const breakdown = await calculateFinalSalary(emp, selectedMonth);

    results.push({
      ...emp,
      ...breakdown   // 👈 VERY IMPORTANT
    });
  }

  setSalaryData(results);
};


  // Login
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (error) alert(error.message);
  };
  const handleForgotPassword = async () => {
  if (!resetEmail) {
    alert("Enter your email");
    return;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
    redirectTo: window.location.origin
  });

  if (error) {
    alert(error.message);
  } else {
    showSuccess("Password reset link sent to your email");
    setShowForgot(false);
    setResetEmail("");
  }
};

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };
  const showSuccess = (message) => {
  setSuccessMessage(message);

  setTimeout(() => {
    setSuccessMessage("");
  }, 2500);
};
const handlePasswordChange = async () => {
  if (!newPassword) {
    alert("Enter new password");
    return;
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    alert(error.message);
  } else {
    showSuccess("Password Updated Successfully");
    setNewPassword("");
    setShowPasswordModal(false);
  }
};
  // Add employee
  const addEmployee = async () => {

    // 1️⃣ Create login account
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email,
      password: "Temp@12345"
    });

    if (signUpError) {
      alert(signUpError.message);
      return;
    }
    if (!data?.user) {
      alert("User creation failed");
      return;
    }
    // 2️⃣ Save employee details with auth_id
    const { error } = await supabase.from("employees").insert([
      {
        name: name,
        email: email,
        salary: salary,
        role: role,
        auth_id: data.user.id,
        shift_start: shiftStart,
        shift_end: shiftEnd
      }
    ]);

    if (error) {
      alert(error.message);
    } else {
      showSuccess("Employee Added Successfully");
      setName("");
      setEmail("");
      setSalary("");
      setShiftStart("");
setShiftEnd("");
      fetchEmployees();
    }
  };

  // Submit attendance report (Employee)
  const submitReport = async () => {
    if (!session) return;

    const today = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    ).toISOString().split("T")[0];


    // First get employee id from employees table
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_id", session.user.id)
      .single();

    if (!emp) {
      alert("Employee not found");
      return;
    }

    // Update existing attendance row instead of inserting new one
    const { error } = await supabase
      .from("attendance")
      .update({
        calls: Number(calls),
        leads: Number(leads),
        revenue: Number(revenue),
        work_note: workNote,
      })
      .eq("employee_id", emp.id)
      .eq("work_date", today);

    if (error) {
      alert(error.message);
    } else {
      showSuccess("Report Submitted Successfully");
      setCalls("");
      setLeads("");
      setRevenue("");
      setWorkNote("");
      fetchReports(); // refresh director dashboard
    }
  };


  const fetchReports = async () => {



    const { data, error } = await supabase
      .from("attendance")
      .select(`
  id,
  work_date,
  login_time,
  logout_time,
  calls,
  leads,
  revenue,
  work_note,
  employees ( name )
`)

      .eq("work_date", selectedDate);


    if (!error) setReports(data);
  };
  const fetchMonthlySummary = async () => {
    const startDate = selectedMonth + "-01";

    const lastDay = new Date(
      selectedMonth.split("-")[0],
      selectedMonth.split("-")[1],
      0
    ).getDate();

    const endDate = selectedMonth + "-" + lastDay;

    const { data, error } = await supabase
      .from("attendance")
      .select("revenue, calls, work_date")
      .gte("work_date", startDate)
      .lte("work_date", endDate);

    if (!error && data) {
      setMonthlyReports(data);
      const totalRevenue = data.reduce(
        (sum, row) => sum + (row.revenue || 0),
        0
      );

      const totalCalls = data.reduce(
        (sum, row) => sum + (row.calls || 0),
        0
      );

      const uniqueDays = [...new Set(data.map(row => row.work_date))].length;

      setMonthlyData({
        totalRevenue,
        totalDays: uniqueDays,
        avgCalls: uniqueDays ? Math.round(totalCalls / uniqueDays) : 0
      });
    }
  };
  const chartData = {
    labels: monthlyReports.map(r =>
      new Date(r.work_date).toLocaleDateString()
    ),
    datasets: [
      {
        label: "Daily Revenue",
        data: monthlyReports.map(r => r.revenue || 0),
        borderColor: "#4f46e5",
        backgroundColor: "#6366f1",
        tension: 0.4
      }
    ]
  };



  const markLogin = async () => {
    if (!session) return;

    const today = new Date().toISOString().split("T")[0];
    // 🔒 Location Check Before Login
const position = await new Promise((resolve, reject) => {
  navigator.geolocation.getCurrentPosition(resolve, reject);
});

const userLat = position.coords.latitude;
const userLng = position.coords.longitude;

const distance = getDistance(userLat, userLng, OFFICE_LAT, OFFICE_LNG);

if (distance > ALLOWED_RADIUS) {
  alert("❌ You are outside office location. Login not allowed.");
  return;
}
    // Get employee table ID using auth_id
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_id", session.user.id)
      .single();

    if (!emp) {
      alert("Employee not found");
      return;
    }

    // Check existing record
    const { data: existing } = await supabase
      .from("attendance")
      .select("*")
      .eq("employee_id", emp.id)
      .eq("work_date", today)
      .maybeSingle();

    if (existing) {
      alert("Already logged in today");
      setTodayAttendance(existing);// 👈 THIS LINE IMPORTANT
      return;
    }

    const { error } = await supabase.from("attendance").insert([
      {
        employee_id: emp.id,
        work_date: today,
        login_time: new Date().toISOString(),
      },
    ]);

    if (error) {
      alert("Login failed: " + error.message);
    } else {
      showSuccess("Login marked successfully");
      checkTodayAttendance();   // 👈 STEP 4 ANSWER (ikkade)
    }
  };

  const markLogout = async () => {
    if (!session) return;

    const today = new Date().toISOString().split("T")[0];
    // 🔒 Location Check Before Logout
const position = await new Promise((resolve, reject) => {
  navigator.geolocation.getCurrentPosition(resolve, reject);
});

const userLat = position.coords.latitude;
const userLng = position.coords.longitude;

const distance = getDistance(userLat, userLng, OFFICE_LAT, OFFICE_LNG);

if (distance > ALLOWED_RADIUS) {
  alert("❌ You are outside office location. Logout not allowed.");
  return;
}       
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_id", session.user.id)
      .single();

    if (!emp) {
      alert("Employee not found");
      return;
    }

    const { error } = await supabase
      .from("attendance")
      .update({
        logout_time: new Date().toISOString(),
      })
      .eq("employee_id", emp.id)   // 👈 STEP 5 ANSWER (ikkade)
      .eq("work_date", today);

    if (error) {
      alert("Logout failed: " + error.message);
    } else {
      showSuccess("Logout marked successfully");
      checkTodayAttendance();   // 👈 STEP 5 ANSWER (ikkade)
    }
  };

  const checkTodayAttendance = async () => {
    if (!session) return;

    const today = new Date().toISOString().split("T")[0];

    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_id", session.user.id)
      .single();

    if (!emp) return;

    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("employee_id", emp.id)
      .eq("work_date", today)
      .maybeSingle();

    setTodayAttendance(data);
  };

  const formatTime = (time) => {
    if (!time) return "-";

    return new Date(time).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
  };
  const calculateSalary = (baseSalary, employeeName) => {
    const employeeRevenue = reports
      .filter(r => r.employees?.name === employeeName)
      .reduce((sum, r) => sum + (r.revenue || 0), 0);

    const commission = employeeRevenue * 0.05;
    return Number(baseSalary) + commission;
  };
const calculateFinalSalary = async (employee, month) => {
  const year = month.split("-")[0];
  const monthNumber = month.split("-")[1];

  const totalDaysInMonth = new Date(year, monthNumber, 0).getDate();
  const dailySalary = employee.salary / totalDaysInMonth;

  const { data: attendanceData } = await supabase
    .from("attendance")
    .select("work_date, login_time, logout_time")
    .eq("employee_id", employee.id)
    .gte("work_date", `${month}-01`)
    .lte("work_date", `${month}-${totalDaysInMonth}`);

  const { data: leaveData } = await supabase
    .from("leave_requests")
    .select("leave_date")
    .eq("employee_id", employee.id)
    .eq("status", "approved")
    .gte("leave_date", `${month}-01`)
    .lte("leave_date", `${month}-${totalDaysInMonth}`);
    const { data: holidayData } = await supabase
  .from("holidays")
  .select("holidays")   // your column name
  .gte("holidays", `${month}-01`)
  .lte("holidays", `${month}-${totalDaysInMonth}`);

const holidayDates = holidayData?.map(h => h.holidays) || [];
let festivalCount = holidayDates.length;

  const attendanceDates = attendanceData?.map(a => a.work_date) || [];
  let lateLoginCount = 0;
let earlyLogoutCount = 0;

for (let record of attendanceData || []) {

  if (!record.login_time || !record.logout_time) continue;
  if (!employee.shift_start || !employee.shift_end) continue;

  const login = new Date(record.login_time);
  const logout = new Date(record.logout_time);

  const shiftStartTime = new Date(`${record.work_date}T${employee.shift_start}`);
  const shiftEndTime = new Date(`${record.work_date}T${employee.shift_end}`);

  if (login > shiftStartTime) {
    lateLoginCount++;
  }

  if (logout < shiftEndTime) {
    earlyLogoutCount++;
  }
}
const halfDayFromLate = Math.floor(lateLoginCount / 3);
const halfDayFromEarly = Math.floor(earlyLogoutCount / 3);

const totalHalfDays = halfDayFromLate + halfDayFromEarly;

const extraDeduction = totalHalfDays * (dailySalary / 2);

  const leaveDates = leaveData?.map(l => l.leave_date) || [];

  let unpaidDays = 0;
  let paidLeaveUsed = false;
  let sundayCount = 0;
  let presentDays = 0;
  let approvedLeaveCount = leaveDates.length;

  for (let day = 1; day <= totalDaysInMonth; day++) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const currentDate = new Date(date);
    const dayOfWeek = currentDate.getDay();

  const isSunday = dayOfWeek === 0;
const isHoliday = holidayDates.includes(date);
const isPresent = attendanceDates.includes(date);
const isLeave = leaveDates.includes(date);

if (isSunday) {
  sundayCount++;
  continue;
}

if (isHoliday) {
  continue; // Paid festival
}

    if (isPresent) {
      presentDays++;
    }

    if (isLeave) {
      if (!paidLeaveUsed) {
        paidLeaveUsed = true;
      } else {
        unpaidDays++;
      }
      continue;
    }

    if (!isPresent) {
      unpaidDays++;
    }
  }

  const deductionAmount =
  unpaidDays * dailySalary + extraDeduction;
  const finalSalary = employee.salary - deductionAmount;

  return {
    totalDaysInMonth,
    sundayCount,
    festivalCount,
    presentDays,
    approvedLeaveCount,
    unpaidDays,
    lateLoginCount,
    earlyLogoutCount,
    dailySalary: Math.round(dailySalary),
    deductionAmount: Math.round(deductionAmount),
    finalSalary: Math.round(employee.salary-deductionAmount)
  };
};
const exportToExcel = () => {
  const worksheetData = salaryData.map(emp => ({
    Name: emp.name,
    "Total Days": emp.totalDaysInMonth,
    Sundays: emp.sundayCount,
    Festivals: emp.festivalCount,
    Present: emp.presentDays,
    "Approved Leaves": emp.approvedLeaveCount,
    "Unpaid Days": emp.unpaidDays,
    "Per Day Salary": emp.dailySalary,
    Deduction: emp.deductionAmount,
    "Final Salary": emp.finalSalary
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Payroll");

  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array"
  });

  const fileData = new Blob([excelBuffer], {
    type:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8"
  });

  saveAs(fileData, `Payroll-${selectedMonth}.xlsx`);
};
const generateSalarySlip = (emp) => {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("Salary Slip", 80, 15);

  doc.setFontSize(12);
  doc.text(`Company: SARS NEXT SOLUTION`, 14, 30);
  doc.text(`Month: ${selectedMonth}`, 14, 37);
  doc.text(`Employee Name: ${emp.name}`, 14, 44);

  autoTable(doc, {
    startY: 55,
    head: [["Description", "Value"]],
    body: [
      ["Total Days", emp.totalDaysInMonth],
      ["Sundays", emp.sundayCount],
      ["Festivals", emp.festivalCount],
      ["Present Days", emp.presentDays],
      ["Approved Leaves", emp.approvedLeaveCount],
      ["Unpaid Days", emp.unpaidDays],
    ["Per Day Salary", `Rs. ${emp.dailySalary}`],
    ["Deduction", `Rs. ${emp.deductionAmount}`],
["Final Salary", `Rs. ${emp.finalSalary}`],
    ],
  });

  doc.save(`SalarySlip-${emp.name}-${selectedMonth}.pdf`);
};

const applyLeave = async () => {
  if (!session) return;

  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_id", session.user.id)
    .single();

  if (!emp) {
    alert("Employee not found");
    return;
  }

  const { error } = await supabase.from("leave_requests").insert([
    {
      employee_id: emp.id,
      leave_date: leaveDate,
      leave_type: leaveType,
      status: "pending"
    }
  ]);

  if (error) {
    alert(error.message);
  } else {
    showSuccess("Leave Applied Successfully");
    setLeaveDate("");
    fetchLeaves();
  }
};
const fetchLeaves = async () => {
  if (!session) return;

  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_id", session.user.id)
    .single();

  if (!emp) return;

  const { data } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("employee_id", emp.id)
    .order("leave_date", { ascending: false });

  setLeaveList(data || []);
};
const fetchAllLeaves = async () => {
  const { data, error } = await supabase
    .from("leave_requests")
    .select(`
      id,
      leave_date,
      leave_type,
      status,
      employees ( name )
    `)
    .order("leave_date", { ascending: false });

  if (!error) {
    setAllLeaves(data || []);
  }
};
const updateLeaveStatus = async (id, newStatus) => {
  const { error } = await supabase
    .from("leave_requests")
    .update({ status: newStatus })
    .eq("id", id);

  if (!error) {
    fetchAllLeaves();
  }
};

  //---------Login Page----------//
  if (!session) {
  return (
    <div className="loginContainer">
      <div className="loginCard">
       <img src="/logo.png" alt="SARS Next Solution" style={{ width: "200px", marginBottom: "20px" }} />
<p style={{ color: "#6b7280" }}>Office Management System</p>

        <input
          placeholder="Email Address"
          value={loginEmail}
          onChange={(e) => setLoginEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={loginPassword}
          onChange={(e) => setLoginPassword(e.target.value)}
        />
        <p 
  style={{ 
    cursor: "pointer", 
    color: "#4f46e5", 
    marginTop: "10px",
    fontSize: "14px"
  }}
  onClick={() => setShowForgot(true)}
>
  Forgot Password?
</p>
        <button onClick={handleLogin}>Login</button>
        {showForgot && (
  <div className="modalOverlay">
    <div className="modalBox">
      <h3>Reset Password</h3>

      <input
        type="email"
        placeholder="Enter your registered email"
        value={resetEmail}
        onChange={(e) => setResetEmail(e.target.value)}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
        <button onClick={() => setShowForgot(false)}>
          Cancel
        </button>
        <button onClick={handleForgotPassword}>
          Send Reset Link
        </button>
      </div>
    </div>
  </div>
)}
      </div>
    </div>
  );
}


  // ---------------- DASHBOARD ----------------

  // Role loading ayye varaku blank chupinchakunda small text
  // Role loading ayye varaku Loading chupinchali
  if (userRole === null) {
    return <h2 style={{ padding: 40 }}>Loading...</h2>;
  }

  // Role not found case
  if (userRole === "unknown") {
    return (
      <div style={{ padding: 40 }}>
        <h2>Access Issue</h2>
        <p>Your role not found. Contact admin.</p>
       <div style={{ display: "flex", gap: "10px" }}>
  <button onClick={() => setShowPasswordModal(true)}>
    Change Password
  </button>
  <button onClick={handleLogout}>Logout</button>
</div>
      </div>
    );
  }




  return (
    <div className="appLayout">

      {userRole === "director" && (
        <div className="sidebar">
         <div className="logoWrapper">
  <img src="/logo.png" alt="SARS Next Solution" />
</div>
          <ul>
          <li 
  className={activePage === "dashboard" ? "activeMenu" : ""}
  onClick={() => setActivePage("dashboard")}
>
  Dashboard
</li>

<li 
  className={activePage === "attendance" ? "activeMenu" : ""}
  onClick={() => setActivePage("attendance")}
>
  Attendance
</li>

<li 
  className={activePage === "reports" ? "activeMenu" : ""}
  onClick={() => setActivePage("reports")}
>
  Reports
</li>

<li 
  className={activePage === "employees" ? "activeMenu" : ""}
  onClick={() => setActivePage("employees")}
>
  Employees
</li>

<li 
  className={activePage === "salary" ? "activeMenu" : ""}
  onClick={() => setActivePage("salary")}
>
  Salary
</li>

<li 
  className={activePage === "leaves" ? "activeMenu" : ""}
  onClick={() => setActivePage("leaves")}
>
  Leaves
</li>


          </ul>
        </div>
      )}

      <div className="mainContent">
      <div className="contentWrapper">


        <div className="header">
          <h1>
            {userRole === "director"
              ? "Director Dashboard"
              : "Employee Dashboard"}
          </h1>

         <p>
  Welcome: {loggedUserName 
    ? loggedUserName.charAt(0).toUpperCase() + loggedUserName.slice(1) 
    : session.user.email}
</p>
<button onClick={() => setShowPasswordModal(true)}>
  Change Password 
  </button>
          <button onClick={handleLogout}>Logout</button>
        </div>
        {showPasswordModal && (
  <div className="modalOverlay">
    <div className="modalBox">
      <h3>Change Password</h3>

      <input
        type="password"
        placeholder="Enter New Password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
        <button onClick={() => setShowPasswordModal(false)}>
          Cancel
        </button>
        <button onClick={handlePasswordChange}>
          Update
        </button>
      </div>
    </div>
  </div>
)}
        </div>

       {userRole === "director" && activePage === "dashboard" && (
  <div className="dashboardContainer">

    <div className="monthSelector card">
      <h2>Monthly Summary</h2>
      <input
        type="month"
        value={selectedMonth}
        onChange={(e) => setSelectedMonth(e.target.value)}
      />
    </div>

    <div className="statsRow">
      <div className="statCard">
        <h3>Total Employees</h3>
        <h1>{employees.length}</h1>
      </div>

      <div className="statCard">
        <h3>Working Now</h3>
        <h1>{reports.filter(r => r.login_time && !r.logout_time).length}</h1>
      </div>

      <div className="statCard">
        <h3>Completed Today</h3>
        <h1>{reports.filter(r => r.logout_time).length}</h1>
      </div>

      <div className="statCard">
        <h3>Total Revenue Today</h3>
        <h1>₹{reports.reduce((sum, r) => sum + (r.revenue || 0), 0)}</h1>
      </div>
    </div>

    <div className="statsRow">
      <div className="statCard">
        <h3>Monthly Revenue</h3>
        <h1>₹{monthlyData.totalRevenue}</h1>
      </div>

      <div className="statCard">
        <h3>Working Days</h3>
        <h1>{monthlyData.totalDays}</h1>
      </div>

      <div className="statCard">
        <h3>Avg Calls / Day</h3>
        <h1>{monthlyData.avgCalls}</h1>
      </div>
    </div>

    {monthlyReports.length > 0 && (
      <div className="card chartCard">
        <h2>Revenue Chart</h2>
        <div style={{ height: "400px" }}>
          <Line
            data={chartData}
            options={{ responsive: true, maintainAspectRatio: false }}
          />
        </div>
      </div>
    )}

  </div>
)}

        {userRole === "employee" && (
          <div className="card">
            <h2>Today's Attendance</h2>

            {!todayAttendance && (
              <button onClick={markLogin}>Mark Login</button>
            )}

            {todayAttendance && !todayAttendance.logout_time && (
              <>
                <p style={{ color: "green" }}>Login marked for today</p>
                <button onClick={markLogout}>Mark Logout</button>
              </>
            )}

            {todayAttendance && todayAttendance.logout_time && (
              <p style={{ color: "blue" }}>
                Today's work completed ✅
              </p>
            )}
          </div>
        )}



        {userRole === "director" && activePage === "employees" && (
          <div className="card">
            <h2>Add Employee</h2>

            <input
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              placeholder="Salary"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
            />
            <input
  type="time"
  value={shiftStart}
  onChange={(e) => setShiftStart(e.target.value)}
  placeholder="Shift Start"
/>

<input
  type="time"
  value={shiftEnd}
  onChange={(e) => setShiftEnd(e.target.value)}
  placeholder="Shift End"
/>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="hr">HR</option>
            </select>
            <button onClick={addEmployee}>Add Employee</button>
          </div>
        )}
        {userRole === "employee" && (
          <div className="card">
            <h2>Submit Daily Report</h2>

            <input
              type="number"
              placeholder="Calls"
              value={calls}
              onChange={(e) => setCalls(e.target.value)}
            />

            <input
              type="number"
              placeholder="Leads"
              value={leads}
              onChange={(e) => setLeads(e.target.value)}
            />

            <input
              type="number"
              placeholder="Revenue"
              value={revenue}
              onChange={(e) => setRevenue(e.target.value)}
            />

            <textarea
              placeholder="Work Note"
              value={workNote}
              onChange={(e) => setWorkNote(e.target.value)}
            />

            <button onClick={submitReport}>Submit Report</button>
          </div>
        )}
        {userRole === "employee" && salaryData.length > 0 && (
  <div className="card">
    <h2>My Salary Slip</h2>

    {salaryData.map(emp => (
      emp.auth_id === session.user.id && (
        <button onClick={() => generateSalarySlip(emp)}>
          Download My Salary Slip
        </button>
      )
    ))}
  </div>
)}
        {userRole === "employee" && (
        <>
  <div className="card">
    <h2>Apply Leave</h2>

  <input
    type="date"
    value={leaveDate}
    onChange={(e) => setLeaveDate(e.target.value)}
  />

  <select
    value={leaveType}
    onChange={(e) => setLeaveType(e.target.value)}
  >
    <option value="sick">Sick Leave</option>
    <option value="casual">Casual Leave</option>
  </select>

  <button onClick={applyLeave}>Apply Leave</button>
</div>

<div className="card">
  <h2>My Leave History</h2>

  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Type</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      {leaveList.map((leave) => (
        <tr key={leave.id}>
          <td>{leave.leave_date}</td>
          <td>{leave.leave_type}</td>
          <td>{leave.status}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
</>
)}

        {activePage === "attendance" && userRole === "director" && (
          <div className="card">


            <h2>Attendance History</h2>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ marginRight: "10px", fontWeight: "bold" }}>
                Select Date:
              </label>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Login Time</th>
                  <th>Logout Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((rep) => (
                  <tr key={rep.id}>
                    <td>{rep.employees?.name}</td>
                    <td>{formatTime(rep.login_time)}</td>
                    <td>{formatTime(rep.logout_time)}</td>
                    <td>
                      {!rep.login_time
                        ? "🔴 Not Logged In"
                        : !rep.logout_time
                          ? "🟢 Working"
                          : "🔵 Completed"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

          </div>
        )}
        {activePage === "leaves" && userRole === "director" && (
  <div className="card">
    <h2>Leave Approval Panel</h2>

    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Date</th>
          <th>Type</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>

      <tbody>
        {allLeaves.map((leave) => (
          <tr key={leave.id}>
            <td>{leave.employees?.name}</td>
            <td>{leave.leave_date}</td>
            <td>{leave.leave_type}</td>
            <td>{leave.status}</td>
            <td>
              {leave.status === "pending" && (
                <>
                  <button onClick={() => updateLeaveStatus(leave.id, "approved")}>
                    Approve
                  </button>
                  <button onClick={() => updateLeaveStatus(leave.id, "rejected")}>
                    Reject
                  </button>
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}






        {activePage === "reports" && userRole === "director" && (
          <div className="card">
            <h2>Employee Performance Reports</h2>

            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Date</th>
                  <th>Calls</th>
                  <th>Leads</th>
                  <th>Revenue</th>
                  <th>Work Note</th>
                </tr>
              </thead>

              <tbody>
                {reports.map((rep) => (
                  <tr key={rep.id}>
                    <td>{rep.employees?.name}</td>
                    <td>{new Date(rep.work_date).toLocaleDateString()}</td>
                    <td>{rep.calls}</td>
                    <td>{rep.leads}</td>
                    <td>{rep.revenue}</td>
                    <td>{rep.work_note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
{activePage === "employees" && (
        <div className="card">
          <h2>Employee List</h2>

          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                {userRole === "director" && (
                  <>
                    <th>Base Salary</th>
                    <th>Calculated Salary</th>
                  </>
                )}

                <th>Role</th>

              </tr>
            </thead>

            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td>{emp.name}</td>
                  <td>{emp.email}</td>
                  {userRole === "director" && (
                    <>
                      <td>₹{emp.salary}</td>
                      <td>₹{emp.salary}</td>
                    </>
                  )}

                  <td>{emp.role}</td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
{activePage === "salary" && userRole === "director" && (
  <div className="card">
    <h2>Salary Breakdown</h2>
    <button onClick={exportToExcel} style={{ marginBottom: "15px" }}>
  Download Excel
</button>

    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Total Days</th>
          <th>Sundays</th>
          <th>Festivals</th>
          <th>Present</th>
          <th>Approved Leaves</th>
          <th>Unpaid Days</th>
          <th>Per Day Salary</th>
          <th>Deduction</th>
          <th>Late Logins</th>
<th>Early Logouts</th>
          <th>Final Salary</th>
          <th>Salary Slip</th>
        </tr>
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
            <td>{emp.unpaidDays}</td>
            <td>₹{emp.dailySalary}</td>
            <td>₹{emp.deductionAmount}</td>
            <td>{emp.lateLoginCount}</td>
<td>{emp.earlyLogoutCount}</td>
            <td><strong>₹{emp.finalSalary}</strong></td>
            <td>
  <button onClick={() => generateSalarySlip(emp)}>
    Generate PDF
  </button>
</td>
          </tr>
        ))}
      </tbody>
    </table>
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

      </div> {/* mainContent */}
    </div> 
);

}

export default App;
