import Bcrypt from "bcryptjs";
import { Request, Response } from "express";
import { prisma } from "../client.js";
import {
  filladmit,
  fillCertificate,
  fillId,
  fillMarksheet,
  generateSecurePassword,
  MarksheetData,
} from "../helper.js";
import {
  sendPasswordResetEmail,
  sendTemporaryPasswordEmail,
} from "../emailHelper.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { redisClient } from "../index.js";
import logger from "../logger.js";

export async function createEnrollment(req: Request, res: Response) {
  //take course id from client
  const {
    name,
    dob,
    fatherName: father,
    motherName: mother,
    Address: address,
    mobile: mobileNo,
    wapp: wpNo,
    eduqualification,
    courseid,
    imageUrl,
    category,
    nationality,
    idtype,
    idProofNo,
    sex,
  } = req.body;

  const dobUpdated = new Date(dob);
  const centerid = Number(req.centerId); //already number ache

  const data = await prisma.enrollment.create({
    data: {
      father,
      category,
      nationality,
      mobileNo,
      idProof: idtype,
      idProofNo,
      mother,
      address,
      status: "pending",
      dob: dobUpdated,
      name,
      wpNo,
      sex,
      course: {
        connect: {
          id: parseInt(courseid),
        },
      },
      eduqualification,

      center: {
        connect: { id: centerid },
      },
      imageLink: imageUrl,
    },
  });

  res.json({ success: true });
}

export async function ActivateEnrollment(req: Request, res: Response) {
  const { id } = req.body;
  const val = await prisma.enrollment.update({
    where: {
      id,
    },
    data: {
      activated: true,
    },
  });

  res.json({ success: true });
}

export async function deActivateEnrollment(req: Request, res: Response) {
  const { id } = req.body;
  const val = await prisma.enrollment.update({
    where: {
      id,
    },
    data: {
      activated: false,
    },
  });

  res.json({ success: true });
}

export async function createCenter(req: Request, res: Response) {
  const { Centername, adminId, address, code } = req.body;

  // Validate input
  if (!Centername || !adminId || !address || !code) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }

  const center = await prisma.center.create({
    data: {
      Centername,
      admin: {
        connect: { id: parseInt(adminId) }, // Ensure adminId is a number
      },
      address,
      code: parseInt(code),
    },
  });

  res.json({ success: true });
}

export async function AllEnrollments(req: Request, res: Response) {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const enrollments = await prisma.enrollment.findMany({
    skip,
    take: limit,
    where: req.Role === "CENTER" ? { centerid: Number(req.centerId) } : {},
    select: {
      admitLink: true,
      certificateLink: true,
      dob: true,
      imageLink: true,
      idCardLink: true,
      marksheetLink: true,
      name: true,
      createdAt: true,
      Enrollmentno: true,
      status: true,
      id: true,
      activated: true, // Ensure activated field is included
    },
  });

  const total = await prisma.enrollment.count(); // Get total count for pagination
  res.json({ enrollments, total });
}

export async function generateCertificate(req: Request, res: Response) {
  const link = await fillCertificate(req.body.data);
  if (link == undefined) return;

  await prisma.enrollment.update({
    where: {
      Enrollmentno: parseInt(req.body.data.EnrollmentNo),
    },
    data: {
      certificateLink: link,
    },
  });
  res.json({ success: true });
}

export async function generateadmit(req: Request, res: Response) {
  const link = await filladmit(req.body.enrollment);

  await prisma.enrollment.update({
    where: {
      Enrollmentno: parseInt(req.body.enrollment.EnrollmentNo),
    },
    data: {
      admitLink: link,
    },
  });
  res.json({ success: true });
}

export async function generateId(req: Request, res: Response) {
  const { Enrollmentno } = req.body;

  const data = await prisma.enrollment.findFirst({
    where: {
      Enrollmentno: parseInt(Enrollmentno),
    },
    select: {
      address: true,
      mobileNo: true,
      imageLink: true,
      center: {
        select: {
          Centername: true,
          code: true,
        },
      },
      IdCardNo: true,
      Enrollmentno: true,
      name: true,
      course: {
        select: {
          CName: true,
        },
      },
    },
  });

  if (!data) {
    res.json({ success: false });
    return;
  }

  const link = await fillId(data);

  await prisma.enrollment.update({
    where: {
      Enrollmentno: data.Enrollmentno,
    },
    data: {
      idCardLink: link,
    },
  });
  res.json({ success: true });
}

export async function generateMarksheet(req: Request, res: Response) {
  const data = req.body.data as MarksheetData;

  if (!data) {
    res.json({ success: false });
    return;
  }

  const link = await fillMarksheet(data);

  await prisma.enrollment.update({
    where: {
      Enrollmentno: data.EnrollmentNo,
    },
    data: {
      marksheetLink: link,
    },
  });

  res.json({ success: true });
}

export async function exmformfillupDatafetch(req: Request, res: Response) {
  // branch admin korbe
  const { enrollmentNo } = req.body;
  const centerid = req.centerId;

  const data = await prisma.enrollment.findFirst({
    where: {
      Enrollmentno: parseInt(enrollmentNo),
      centerid,
    },
    select: {
      name: true,
      father: true,
      dob: true,
      IdCardNo: true,
      wpNo: true,
      mobileNo: true,
      address: true,
      center: {
        select: {
          Centername: true,
          address: true,
        },
      },
      course: {
        select: {
          CName: true,
          subjects: true,
        },
      },
    },
  });

  res.json({ success: true, data });
}

export async function createCourse(req: Request, res: Response) {
  const { Duration, CName, price } = req.body;

  const data = await prisma.course.create({
    data: {
      Duration,
      CName,
      price,
    },
  });

  res.json({ success: true });
}

export async function exmformApprove(req: Request, res: Response) {
  const { id } = req.body;

  const data = await prisma.examForm.update({
    where: {
      id,
    },
    data: {
      verified: true,
    },
  });

  res.json({ success: true });
}

export async function exmformDisApprove(req: Request, res: Response) {
  const { id } = req.body;

  const data = await prisma.examForm.update({
    where: {
      id,
    },
    data: {
      verified: false,
    },
  });

  res.json({ success: true });
}

export async function exmmarksApprove(req: Request, res: Response) {
  const { id } = req.body;

  const data = await prisma.marks.update({
    where: {
      id,
    },
    data: {
      verified: true,
    },
  });

  res.json({ success: true });
}
export async function exmmarksDisApprove(req: Request, res: Response) {
  const { id } = req.body;

  const data = await prisma.marks.update({
    where: {
      id,
    },
    data: {
      verified: false,
    },
  });

  res.json({ success: true });
}
export async function exmmarksentry(req: Request, res: Response) {
  const { EnrollmentNo, marks, remarks, grade, percentage, totalMarks, year } =
    req.body;
  const p = parseFloat(percentage);
  const tm = parseFloat(totalMarks);

  const data = await prisma.marks.create({
    data: {
      EnrollmentNo: parseInt(EnrollmentNo),
      marks,
      remarks,
      grade,
      percentage: p,
      totalMarks: tm,
      year,
    },
  });

  res.json({ success: true });
}

export async function exmformsfetch(req: Request, res: Response) {
  //FIXME
  const data = await prisma.examForm.findMany({
    where: {},
    include: {
      enrollment: {
        select: {
          name: true,
          mobileNo: true,
          wpNo: true,
          Enrollmentno: true,
          imageLink: true,
          address: true,
          father: true,
          center: {
            select: {
              Centername: true,
              code: true,
            },
          },
          IdCardNo: true,
          amount: {
            select: {
              lastPaymentRecieptno: true,
            },
          },
          course: {
            select: {
              CName: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  res.json({ success: true, data });
}

export async function marksheetfetch(req: Request, res: Response) {
  const data = await prisma.marks.findMany({
    where: {
      enrollment: {
        centerid: 1, // Filter by center ID inside enrollment
      },
    },
    include: {
      enrollment: {
        // First include enrollment
        select: {
          name: true,
          father: true,
          dob: true,
          imageLink: true,
          CertificateNo: true,
          course: {
            select: {
              CName: true,
              Duration: true,
            },
          },
          center: {
            select: {
              Centername: true,
              code: true,
              address: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  res.json({ success: true, data });
}
export async function TakeEnquiry(req: Request, res: Response) {
  const {
    name,
    email,
    father,
    dob,
    sex,
    category,
    nationality,
    mobileNo,
    address: { AddressLine, vill, po, ps, pin },
    eduqualification,
    dist,
    coName,
    state,
    idProof,
    idProofNo,
    houseRoomNo,
    squareFit,
    tradeLicense,
    bathroom,
    signatureLink,
    stateCoordinator,
    districtCoordinator,
    subdistrictCoordinator,
  } = req.body;
  const bathroomValue = bathroom == "Yes" ? true : false;
  const dobUpdated = new Date(dob);

  const sx = sex.toUpperCase();
  const nt = nationality.toUpperCase();

  await prisma.enquiry.create({
    data: {
      coName,
      vill,
      po,
      pin,
      ps,
      dist,
      state,
      email,
      father,
      dob: dobUpdated,
      sex: sx,
      category,
      nationality: nt,
      mobileNo,
      AddressLine,
      name,
      eduqualification,
      idProof,
      idProofNo,
      houseRoomNo,
      squareFit,
      tradeLicense,
      bathroom: bathroomValue,
      signatureLink,
      stateCoordinator,
      districtCoordinator,
      subdistrictCoordinator,
    },
  });

  res.json({ success: true });
}
export async function FetchAllEnquiry(req: Request, res: Response) {
  const data = await prisma.enquiry.findMany({
    where: {},
  });

  res.json({ data });
}
export async function examFormFillup(req: Request, res: Response) {
  const {
    enrollmentNo,
    ATI_CODE,
    ExamCenterCode,
    lastpaymentR,
    ped,
    ted,
    pet,
    tet,
    SemNo,
  } = req.body;

  const data = await prisma.examForm.create({
    data: {
      EnrollmentNo: parseInt(enrollmentNo),
      ATI_CODE,
      ExamCenterCode,
      practExmdate: ped,
      theoryExamdate: ted,
      practExmtime: pet,
      theoryExmtime: tet,
      sem: SemNo,
    },
  });

  await prisma.amount.update({
    where: {
      EnrollmentNo: data.EnrollmentNo,
    },
    data: {
      lastPaymentRecieptno: lastpaymentR,
    },
  });

  res.json({ success: true });
}

export async function amountFetch(req: Request, res: Response) {
  const id = Number(req.centerId);

  const data = await prisma.enrollment.findMany({
    where: {
      centerid: id,
    },
    select: {
      name: true,
      Enrollmentno: true,
      id: true,
      amount: {
        select: {
          amountRemain: true,
          TotalPaid: true,
        },
      },
      course: {
        select: {
          price: true,
        },
      },
    },
  });

  res.json({ success: true, data });
}

export async function amountEdit(req: Request, res: Response) {
  const { EnrollmentNo, tp, ar } = req.body;
  const TotalPaid = parseInt(tp);
  const amountRemain = parseInt(ar);
  const updatedEnroll = parseInt(EnrollmentNo);

  const data = await prisma.amount.upsert({
    where: {
      EnrollmentNo: updatedEnroll,
    },
    create: {
      TotalPaid,
      amountRemain,
      enrollment: {
        connect: {
          Enrollmentno: updatedEnroll,
        },
      },
    },
    update: {
      TotalPaid: {
        increment: TotalPaid,
      },
      amountRemain,
    },
  });

  res.json({ success: true });
}

export async function VerifyEnquiry(req: Request, res: Response) {
  //ekta center create hobe and admin assign hobe

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const name = req.query.name as string;
  const email = req.query.email as string;

  function sendUpdate(step: number, message: string) {
    res.write(`data: ${JSON.stringify({ step, message })}\n\n`);
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        email,
      },
    });

    if (user) {
      sendUpdate(0, "User already exists");
      res.end(); // End the SSE stream properly
      return;
    }

    const Random_Password = generateSecurePassword();
    const hashedPassword = await Bcrypt.hash(Random_Password, 10);

    //send password to mail
    sendUpdate(1, "sending temporary password to mail");

    await sendTemporaryPasswordEmail(email, Random_Password);

    const tempdata = await prisma.enquiry.findFirst({
      where: {
        email,
      },
      select: {
        AddressLine: true,
        vill: true,
      },
    });

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    const data = await prisma.center.create({
      data: {
        adminid: newUser.id,
        address: tempdata!.AddressLine,
        Centername: `${tempdata?.vill} MISSION NATIONAL YOUTH COMPUTER CENTER`,
      },
    });
    sendUpdate(2, "center created");
    res.end();
  } catch (error) {
    logger.error("Error in VerifyEnquiry:", error);
    sendUpdate(-1, "An error occurred");
    res.end();
  }

  req.on("close", () => {
    logger.info("Client disconnected");
    res.end();
  });
}

export async function ChangePassword(req: Request, res: Response) {
  const { oldPassword, newPassword, email } = req.body;

  const data = await prisma.user.findFirst({
    where: {
      email,
    },
  });

  if (!data) {
    res.json({ message: "no user found" });
    return;
  }

  const isPasswordValid = await Bcrypt.compare(oldPassword, data.password);

  if (!isPasswordValid) {
    res.status(200).json({ error: "Invalid credentials" });
    return;
  }

  const hashedPassword = await Bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: {
      id: data.id,
    },
    data: {
      password: hashedPassword,
    },
  });
  res.json({ success: true });
}

export async function SendResetLink(req: Request, res: Response) {
  const { email } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  // Generate a secure reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour expiry

  await prisma.user.update({
    where: { email },
    data: { resetToken, resetTokenExpiry },
  });

  const resetLink = `${process.env.CORSORIGIN}/resetpassword?token=${resetToken}`;

  await sendPasswordResetEmail(email, resetLink);

  res.json({
    success: true,
    message: "Reset password link sent to your email",
  });
}

export async function ResetPassword(req: Request, res: Response) {
  const { token } = req.params;
  const { newPassword } = req.body;

  const user = await prisma.user.findFirst({
    where: { resetToken: token, resetTokenExpiry: { gt: new Date() } },
  });

  if (!user) {
    res.status(400).json({ message: "Invalid or expired token" });
    return;
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  res.json({ success: true, message: "Password reset successful" });
}

export async function subjectAdd(req: Request, res: Response) {
  const { c, cid } = req.body;
  const subjects = JSON.parse(c);

  await prisma.course.update({
    where: {
      id: parseInt(cid),
    },
    data: {
      subjects,
    },
  });

  res.json({ success: true });
}

export async function noticefetch(req: Request, res: Response) {
  try {
    const cacheKey = "notices";
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      res.json(JSON.parse(cachedData));
      return;
    }

    const notices = await prisma.notices.findMany({
      where: { upto: { gt: new Date() } },
      orderBy: { upto: "desc" },
    });

    await redisClient.set(cacheKey, JSON.stringify(notices), "EX", 3600 * 24); // Cache for 1 hour
    res.json(notices);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch notices" });
  }
}

export async function noticecreate(req: Request, res: Response) {
  const { subject: heading, details: body, expiryDate: upto } = req.body;

  await prisma.notices.create({
    data: {
      body,
      heading,
      upto: new Date(upto),
    },
  });

  await redisClient.del("notices");

  res.json({ success: true });
}
