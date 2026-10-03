import http from "http";

function request(options: http.RequestOptions, body?: any): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({ statusCode: res.statusCode || 500, data: json });
      });
    });
    req.on("error", reject);
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

async function testTeacherLessonUnits() {
  console.log("=== TESTING TEACHER LESSON CREATION & MULTI-TERM UNITS ===");

  // 1. Teacher Login
  console.log("\n[TEST 1] Teacher Login");
  const loginRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { email: "teacher@tuklas.ai", password: "Tuklas2026!" }
  );

  if (loginRes.statusCode !== 200 || !loginRes.data.token) {
    throw new Error(`Teacher login failed: ${JSON.stringify(loginRes.data)}`);
  }
  const teacherToken = loginRes.data.token;
  console.log("-> Authenticated Teacher:", loginRes.data.user.name);

  // 2. Fetch Curriculum
  console.log("\n[TEST 2] Fetch Curriculum & Verify Multi-Term Support");
  const curRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/curriculum",
    method: "GET",
    headers: { Authorization: `Bearer ${teacherToken}` },
  });

  if (curRes.statusCode !== 200 || !curRes.data.data) {
    throw new Error(`Failed to load curriculum: ${JSON.stringify(curRes.data)}`);
  }

  const terms = curRes.data.data[0]?.grades?.[0]?.terms || [];
  console.log(`-> Loaded ${terms.length} terms for Grade 7`);
  if (terms.length < 4) {
    throw new Error(`Expected at least 4 terms, found ${terms.length}`);
  }

  terms.forEach((t: any) => {
    console.log(`   * ${t.name}: ${t.units.length} units`);
  });

  const term2 = terms.find((t: any) => t.termNumber === 2);
  if (!term2) throw new Error("Term 2 not found in curriculum");
  const term2Unit1 = term2.units[0];
  console.log(`-> Term 2, Unit 1: "${term2Unit1.title}" (${term2Unit1.id})`);

  // 3. Create Lesson in Term 2 existing unit
  console.log("\n[TEST 3] Create Lesson in Next Term (Term 2) Existing Unit");
  const createLsnRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/lessons",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${teacherToken}`,
      },
    },
    {
      title: "Metric Conversions in Everyday Measurement",
      description: "Students master converting units of length, mass, and volume using conversion factors.",
      unitId: term2Unit1.id,
      learningObjectives: [
        "Express metric measurements in smaller or larger units.",
        "Apply dimensional analysis to real-life measurement situations.",
      ],
      estimatedMinutes: 25,
    }
  );

  if (createLsnRes.statusCode !== 201 || !createLsnRes.data.data) {
    throw new Error(`Failed to create Term 2 lesson: ${JSON.stringify(createLsnRes.data)}`);
  }
  const lesson1 = createLsnRes.data.data;
  console.log(`-> Created lesson: "${lesson1.title}" (ID: ${lesson1.id}, Status: ${lesson1.status})`);

  // 4. Create Lesson with On-The-Fly Custom Unit in Term 3
  console.log("\n[TEST 4] Create Lesson with Dynamic Custom Unit in Term 3");
  const term3 = terms.find((t: any) => t.termNumber === 3);
  if (!term3) throw new Error("Term 3 not found in curriculum");

  const customUnitTitle = `Unit 3: Special Algebraic Identities & Modeling (${Date.now().toString().slice(-4)})`;
  const createCustomRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/lessons",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${teacherToken}`,
      },
    },
    {
      title: "Modeling Word Problems with Linear Equations",
      description: "Formulating and solving linear equations from practical scenarios.",
      termId: term3.id,
      newUnitTitle: customUnitTitle,
      newUnitDescription: "Advanced linear modeling concepts for Grade 7 MATATAG Quarter 3.",
      learningObjectives: [
        "Translate verbal statements into algebraic equations.",
        "Verify solutions by substitution.",
      ],
      estimatedMinutes: 30,
    }
  );

  if (createCustomRes.statusCode !== 201 || !createCustomRes.data.data) {
    throw new Error(`Failed to create lesson with custom unit: ${JSON.stringify(createCustomRes.data)}`);
  }
  const lesson2 = createCustomRes.data.data;
  console.log(`-> Created lesson with dynamic unit: "${lesson2.title}" (ID: ${lesson2.id})`);
  console.log(`-> Linked Unit: "${lesson2.unit?.title}" under Term: "${lesson2.unit?.term?.name}"`);

  if (!lesson2.unit || lesson2.unit.title !== customUnitTitle) {
    throw new Error(`Unit was not correctly created/linked! Expected "${customUnitTitle}", got "${lesson2.unit?.title}"`);
  }

  // 5. Publish the Term 2 lesson through the workflow
  console.log("\n[TEST 5] Progress Lesson to PUBLISHED Status");
  // DRAFT -> REVIEW
  const rReview = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/lessons/${lesson1.id}/status`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${teacherToken}`,
      },
    },
    { targetStatus: "REVIEW" }
  );
  if (rReview.statusCode !== 200) throw new Error(`Failed DRAFT->REVIEW: ${JSON.stringify(rReview.data)}`);

  // REVIEW -> APPROVED
  const rApproved = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/lessons/${lesson1.id}/status`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${teacherToken}`,
      },
    },
    { targetStatus: "APPROVED" }
  );
  if (rApproved.statusCode !== 200) throw new Error(`Failed REVIEW->APPROVED: ${JSON.stringify(rApproved.data)}`);

  // APPROVED -> PUBLISHED
  const rPublished = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/lessons/${lesson1.id}/status`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${teacherToken}`,
      },
    },
    { targetStatus: "PUBLISHED" }
  );
  if (rPublished.statusCode !== 200) throw new Error(`Failed APPROVED->PUBLISHED: ${JSON.stringify(rPublished.data)}`);
  console.log(`-> Lesson "${lesson1.title}" successfully PUBLISHED!`);

  // 6. Student Login & Verify Learning Path Access
  console.log("\n[TEST 6] Student Access to Published Lesson");
  const studentLogin = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { email: "student@tuklas.ai", password: "Tuklas2026!" }
  );
  if (studentLogin.statusCode !== 200) throw new Error("Student login failed");
  const studentToken = studentLogin.data.token;

  const pathRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/student/learning-path",
    method: "GET",
    headers: { Authorization: `Bearer ${studentToken}` },
  });

  if (pathRes.statusCode !== 200 || !pathRes.data.data) {
    throw new Error(`Failed to load student learning path: ${JSON.stringify(pathRes.data)}`);
  }

  const nodes = pathRes.data.data.learningPath;
  console.log(`-> Student learning path has ${nodes.length} published lessons`);
  const publishedNode = nodes.find((n: any) => n.lessonId === lesson1.id);
  if (!publishedNode) {
    throw new Error(`Newly published lesson "${lesson1.title}" not found in student learning path!`);
  }
  console.log(`-> Found newly published lesson in student path: "${publishedNode.title}" (State: ${publishedNode.state})`);

  console.log("\n=======================================================");
  console.log(">>> ALL TEACHER LESSON & UNIT INTEGRATION TESTS PASSED! <<<");
  console.log("=======================================================");
}

testTeacherLessonUnits()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
