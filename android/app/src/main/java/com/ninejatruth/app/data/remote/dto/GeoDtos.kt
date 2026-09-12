package com.ninejatruth.app.data.remote.dto

import com.google.gson.annotations.SerializedName

data class StateDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("code") val code: String?,
    @SerializedName("region") val region: String?,
    @SerializedName("capital") val capital: String?,
    @SerializedName("population") val population: Long?,
    @SerializedName("lgas") val lgas: List<LgaDto> = emptyList()
)

data class LgaDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("stateId") val stateId: String,
    @SerializedName("headquarters") val headquarters: String?,
    @SerializedName("wards") val wards: List<WardDto> = emptyList()
)

data class WardDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("lgaId") val lgaId: String,
    @SerializedName("communities") val communities: List<CommunityDto> = emptyList()
)

data class CommunityDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("wardId") val wardId: String,
    @SerializedName("population") val population: Long?
)
