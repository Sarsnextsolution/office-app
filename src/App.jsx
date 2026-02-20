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

function App() {
  const [session, setSession] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [userRole, setUserRole] = useState(null);
const [activePage, setActivePage] = useState("dashboard");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [salary, setSalary] = useState("");
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



  const [workNote, setWorkNote] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

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

  // Fetch employees after login
  useEffect(() => {
    if (session) {
      fetchUserRole(session.user.id);
    }
  }, [session]);
  useEffect(() => {
    if (session) {
      checkTodayAttendance();
    }
  }, [session]);

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
  if (activePage === "salary" && userRole === "director") {
    generateSalaryData();
  }
}, [activePage, selectedMonth]);





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
const generateSalaryData = async () => {
  const results = [];

  for (let emp of employees) {
 const breakdown = await calculateFinalSalary(emp, selectedMonth);

results.push({
  ...emp,
  ...breakdown
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

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
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
        auth_id: data.user.id
      }
    ]);

    if (error) {
      alert(error.message);
    } else {
      alert("Employee Added Successfully");
      setName("");
      setEmail("");
      setSalary("");
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
      alert("Report Submitted Successfully");
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
      alert("Login marked successfully");
      checkTodayAttendance();   // 👈 STEP 4 ANSWER (ikkade)
    }
  };

  const markLogout = async () => {
    if (!session) return;

    const today = new Date().toISOString().split("T")[0];

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
      alert("Logout marked successfully");
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
    .select("work_date")
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

  const attendanceDates = attendanceData?.map(a => a.work_date) || [];
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
    const isPresent = attendanceDates.includes(date);
    const isLeave = leaveDates.includes(date);

    if (isSunday) {
      sundayCount++;
      continue;
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

  const deductionAmount = unpaidDays * dailySalary;
  const finalSalary = employee.salary - deductionAmount;

  return {
    totalDaysInMonth,
    sundayCount,
    presentDays,
    approvedLeaveCount,
    unpaidDays,
    dailySalary: Math.round(dailySalary),
    deductionAmount: Math.round(deductionAmount),
    finalSalary: Math.round(finalSalary)
  };
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
    alert("Leave Applied Successfully");
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
      <div className="container">
        <div className="card">
          <h2>Office Management Login</h2>

          <input
            placeholder="Email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
          />

          <button onClick={handleLogin}>Login</button>
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
        <button onClick={handleLogout}>Logout</button>
      </div>
    );
  }




  return (
    <div className="appLayout">

      {userRole === "director" && (
        <div className="sidebar">
          <h2 className="logoText">SARS Admin</h2>
          <ul>
            <li onClick={() => setActivePage("dashboard")}>Dashboard</li>
<li onClick={() => setActivePage("attendance")}>Attendance</li>
<li onClick={() => setActivePage("reports")}>Reports</li>
<li onClick={() => setActivePage("employees")}>Employees</li>
<li onClick={() => setActivePage("salary")}>Salary</li>
<li onClick={() => setActivePage("leaves")}>Leaves</li>



          </ul>
        </div>
      )}

      <div className="mainContent">


        <div className="header">
          <h1>
            {userRole === "director"
              ? "Director Dashboard"
              : "Employee Dashboard"}
          </h1>

          <p>Welcome: {session.user.email}</p>

          <button onClick={handleLogout}>Logout</button>
        </div>
        {userRole === "director" && (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "20px",
              marginBottom: "30px"
            }}>

              <div className="statCard">
                <h3>Total Employees</h3>
                <h1>{employees.length}</h1>
              </div>

              <div className="statCard">
                <h3>Working Now</h3>
                <h1>
                  {reports.filter(r => r.login_time && !r.logout_time).length}
                </h1>
              </div>

              <div className="statCard">
                <h3>Completed Today</h3>
                <h1>
                  {reports.filter(r => r.logout_time).length}
                </h1>
              </div>

              <div className="statCard">
                <h3>Total Revenue Today</h3>
                <h1>
                  ₹{reports.reduce((sum, r) => sum + (r.revenue || 0), 0)}
                </h1>
              </div>


            </div>
          </>
        )}
        {userRole === "director" && (
          <div className="card">
            <h2>📊 Monthly Summary</h2>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ marginRight: "10px", fontWeight: "bold" }}>
                Select Month:
              </label>

              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "15px"
            }}>

              <div className="statCard">
                <h3>Total Revenue</h3>
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



        {userRole === "director" && (
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

        {userRole === "director" && monthlyReports.length > 0 && (
          <div className="card" style={{ width: "100%" }}>
            <h2>📈 Revenue Chart</h2>

            <div style={{ height: "400px" }}>
              <Line
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: true }
                  }
                }}
              />
            </div>
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

    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Total Days</th>
          <th>Sundays</th>
          <th>Present</th>
          <th>Approved Leaves</th>
          <th>Unpaid Days</th>
          <th>Per Day Salary</th>
          <th>Deduction</th>
          <th>Final Salary</th>
        </tr>
      </thead>
      <tbody>
        {salaryData.map(emp => (
          <tr key={emp.id}>
            <td>{emp.name}</td>
            <td>{emp.totalDaysInMonth}</td>
            <td>{emp.sundayCount}</td>
            <td>{emp.presentDays}</td>
            <td>{emp.approvedLeaveCount}</td>
            <td>{emp.unpaidDays}</td>
            <td>₹{emp.dailySalary}</td>
            <td>₹{emp.deductionAmount}</td>
            <td><strong>₹{emp.finalSalary}</strong></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}


      </div> {/* mainContent */}
    </div> 
);

}

export default App;
