package com.jobscheduler.user.dto

import com.jobscheduler.user.AppUser

data class MeResponse(
    val id: Long,
    val email: String,
    val name: String?,
    val pictureUrl: String?,
    val onboarded: Boolean,
) {
    companion object {
        fun from(u: AppUser) = MeResponse(u.id!!, u.email, u.name, u.pictureUrl, u.onboarded)
    }
}
