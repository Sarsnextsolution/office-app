import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function App() {
  const [session, setSession] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [userRole, setUserRole] = useState(null);
 
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [salary, setSalary] = useState("");
  const [role, setRole] = useState("employee");
  const [calls, setCalls] = useState("");
const [leads, setLeads] = useState("");
const [revenue, setRevenue] = useState("");
const [todayAttendance, setTodayAttendance] = useState(null);


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
  }
}, [session, userRole]);


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
if (!authData?.user) {
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
const [reports, setReports] = useState([]);

const fetchReports = async () => {
  const today = new Date(
  new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
).toISOString().split("T")[0];


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

    .eq("work_date", today);

  if (!error) setReports(data);
};


const markLogin = async () => {
  if (!session) return;

  const today = new Date(
  new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
).toISOString().split("T")[0];


  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_id", session.user.id)
    .single();

  if (!emp) return;

  const { data: existing } = await supabase
    .from("attendance")
    .select("*")
    .eq("employee_id", emp.id)
    .eq("work_date", today)
    .maybeSingle();

  if (existing && !existing.logout_time) {
    setTodayAttendance(existing);
    alert("Already logged in today");
    return;
  }

  const { data, error } = await supabase
    .from("attendance")
    .insert([
      {
        employee_id: emp.id,
        work_date: today,
        login_time: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (!error) {
    setTodayAttendance(data);
    alert("Login marked successfully");
  }
};

const markLogout = async () => {
  if (!todayAttendance) return;

  const { data, error } = await supabase
    .from("attendance")
    .update({
      logout_time: new Date().toISOString(),
    })
    .eq("id", todayAttendance.id)
    .select()
    .single();

  if (!error) {
    setTodayAttendance(data);
    alert("Logout marked successfully");
  }
};

const checkTodayAttendance = async () => {
  if (!session) return;

  const today = new Date(
  new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
).toISOString().split("T")[0];


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
  <div className="container">

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
<h2>Today's Attendance Status</h2>

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
        <td>
          {rep.login_time
            ? new Date(rep.login_time).toLocaleString("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

            : "-"}
        </td>
        <td>
          {rep.logout_time
            ? new Date(rep.logout_time).toLocaleString("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

            : "-"}
        </td>
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

{userRole === "director" && (
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

    <div className="card">
      <h2>Employee List</h2>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            {userRole === "director" && <th>Salary</th>}
<th>Role</th>

          </tr>
        </thead>

        <tbody>
          {employees.map((emp) => (
            <tr key={emp.id}>
              <td>{emp.name}</td>
              <td>{emp.email}</td>
              {userRole === "director" && <td>{emp.salary}</td>}
<td>{emp.role}</td>

            </tr>
          ))}
        </tbody>
      </table>
    </div>

  </div>
);

}

export default App;
