import { dbService } from "../src/lib/db";

async function run() {
  const pilotUser = await dbService.findUserByEmail("student.pilot@tuklas.ph");
  const testStudentId = pilotUser ? pilotUser.id : "usr_student_01";
  const pathData = await dbService.getStudentLearningPath(testStudentId);
  console.log("Path nodes with unit/subject:", pathData.learningPath.slice(0, 5).map((n: any) => ({
    lessonId: n.lessonId,
    title: n.title,
    unitId: n.unitId,
    subjectId: n.subjectId,
    state: n.state
  })));
}

run();
