import { AppError, handleApiError, jsonResponse, readJsonBody } from "@/lib/http"
import { submitShopRegistrationRequest } from "@/lib/shop-registration"
import {
  asClockMinutes,
  asEmail,
  asLatitude,
  asLongitude,
  asMeterRadius,
  asOptionalTrimmedString,
  asPassword,
  asPayrollPayday,
  asTrimmedString,
} from "@/lib/validators"

type ShopRegisterBody = {
  shopName?: unknown
  ownerFirstName?: unknown
  ownerLastName?: unknown
  ownerPhone?: unknown
  ownerEmail?: unknown
  ownerPassword?: unknown
  branchName?: unknown
  payrollPayday?: unknown
  morningShiftStartTime?: unknown
  morningShiftEndTime?: unknown
  afternoonShiftStartTime?: unknown
  afternoonShiftEndTime?: unknown
  nightShiftStartTime?: unknown
  nightShiftEndTime?: unknown
  latitude?: unknown
  longitude?: unknown
  allowedRadiusMeters?: unknown
  salesAgentId?: unknown
}

function assertShiftRange(
  startMinutes: number,
  endMinutes: number,
  label: string,
  allowCrossMidnight: boolean,
) {
  if (allowCrossMidnight) {
    if (startMinutes === endMinutes) {
      throw new AppError(
        `${label} ต้องมีเวลาเข้าและเวลาออกไม่ซ้ำกัน`,
        400,
        "INVALID_INPUT",
      )
    }
    return
  }

  if (endMinutes <= startMinutes) {
    throw new AppError(
      `${label} เวลาเลิกงานต้องมากกว่าเวลาเข้างาน`,
      400,
      "INVALID_INPUT",
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBody<ShopRegisterBody>(req)
    const shopName = asTrimmedString(body.shopName, "shopName")
    const ownerFirstName = asTrimmedString(body.ownerFirstName, "ownerFirstName")
    const ownerLastName = asTrimmedString(body.ownerLastName, "ownerLastName")
    const ownerPhone = asOptionalTrimmedString(body.ownerPhone)
    const ownerEmail = asEmail(body.ownerEmail, "ownerEmail")
    const ownerPassword = asPassword(body.ownerPassword)
    const branchName =
      asOptionalTrimmedString(body.branchName) || `${shopName} - สาขาหลัก`
    const payrollPayday = asPayrollPayday(body.payrollPayday)
    const morningShiftStartMinutes = asClockMinutes(
      body.morningShiftStartTime,
      "morningShiftStartTime",
    )
    const morningShiftEndMinutes = asClockMinutes(
      body.morningShiftEndTime,
      "morningShiftEndTime",
    )
    const afternoonShiftStartMinutes = asClockMinutes(
      body.afternoonShiftStartTime,
      "afternoonShiftStartTime",
    )
    const afternoonShiftEndMinutes = asClockMinutes(
      body.afternoonShiftEndTime,
      "afternoonShiftEndTime",
    )
    const nightShiftStartMinutes = asClockMinutes(
      body.nightShiftStartTime,
      "nightShiftStartTime",
    )
    const nightShiftEndMinutes = asClockMinutes(
      body.nightShiftEndTime,
      "nightShiftEndTime",
    )
    const latitude = asLatitude(body.latitude)
    const longitude = asLongitude(body.longitude)
    const allowedRadiusMeters = asMeterRadius(body.allowedRadiusMeters)
    const salesAgentId = asOptionalTrimmedString(body.salesAgentId)

    assertShiftRange(
      morningShiftStartMinutes,
      morningShiftEndMinutes,
      "กะเช้า",
      false,
    )
    assertShiftRange(
      afternoonShiftStartMinutes,
      afternoonShiftEndMinutes,
      "กะบ่าย",
      false,
    )
    assertShiftRange(
      nightShiftStartMinutes,
      nightShiftEndMinutes,
      "กะดึก",
      true,
    )

    const result = await submitShopRegistrationRequest({
      shopName,
      ownerFirstName,
      ownerLastName,
      ownerPhone,
      ownerEmail,
      ownerPassword,
      branchName,
      payrollPayday,
      morningShiftStartMinutes,
      morningShiftEndMinutes,
      afternoonShiftStartMinutes,
      afternoonShiftEndMinutes,
      nightShiftStartMinutes,
      nightShiftEndMinutes,
      latitude,
      longitude,
      allowedRadiusMeters,
      salesAgentId,
    })

    return jsonResponse(
      {
        ok: true,
        request: result,
        message:
          "ส่งคำขอเปิดร้านเรียบร้อยแล้ว กรุณารอทีมซัพพอร์ตตรวจสอบและอนุมัติ",
      },
      201,
    )
  } catch (error) {
    return handleApiError(error)
  }
}
