package com.ninejatruth.app.data.remote.dto

import com.google.gson.annotations.SerializedName

data class ApiResponse<T, M>(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String? = null,
    @SerializedName("data") val data: T? = null,
    @SerializedName("meta") val meta: M? = null,
    @SerializedName("errors") val errors: List<String>? = null,
    @SerializedName("timestamp") val timestamp: String? = null
)

data class PaginationMeta(
    @SerializedName("page") val page: Int,
    @SerializedName("limit") val limit: Int,
    @SerializedName("total") val total: Int,
    @SerializedName("totalPages") val totalPages: Int,
    @SerializedName("hasNext") val hasNext: Boolean,
    @SerializedName("hasPrev") val hasPrev: Boolean
)
