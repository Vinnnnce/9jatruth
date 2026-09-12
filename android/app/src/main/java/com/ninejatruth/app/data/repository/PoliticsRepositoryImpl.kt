package com.ninejatruth.app.data.repository

import com.ninejatruth.app.data.local.dao.PartyDao
import com.ninejatruth.app.data.local.entity.CandidateEntity
import com.ninejatruth.app.data.local.entity.PartyEntity
import com.ninejatruth.app.data.remote.api.PoliticsApi
import com.ninejatruth.app.domain.model.Candidate
import com.ninejatruth.app.domain.model.Election
import com.ninejatruth.app.domain.model.Office
import com.ninejatruth.app.domain.model.Party
import com.ninejatruth.app.domain.repository.PoliticsRepository
import com.ninejatruth.app.domain.util.Result
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PoliticsRepositoryImpl @Inject constructor(
    private val politicsApi: PoliticsApi,
    private val partyDao: PartyDao
) : PoliticsRepository {

    override fun getParties(page: Int): Flow<Result<List<Party>>> = flow {
        emit(Result.Loading)
        try {
            val response = politicsApi.getParties(page, 20)
            if (response.isSuccessful) {
                val parties = response.body()?.data?.map { it.toDomain() } ?: emptyList()
                partyDao.insertParties(parties.map { it.toEntity() })
                emit(Result.Success(parties))
            } else {
                emit(Result.Error(response.message() ?: "Failed to load parties"))
            }
        } catch (e: Exception) {
            // Try cache
            partyDao.getAllParties().collect { cached ->
                if (cached.isNotEmpty()) {
                    emit(Result.Success(cached.map { it.toDomain() }))
                } else {
                    emit(Result.Error(e.localizedMessage ?: "Network error"))
                }
                return@collect
            }
        }
    }

    override fun getParty(partyId: String): Flow<Result<Party>> = flow {
        emit(Result.Loading)
        try {
            val response = politicsApi.getParty(partyId)
            if (response.isSuccessful) {
                val party = response.body()?.data?.toDomain()
                if (party != null) {
                    emit(Result.Success(party))
                } else {
                    emit(Result.Error("Party not found"))
                }
            } else {
                emit(Result.Error(response.message() ?: "Failed to load party"))
            }
        } catch (e: Exception) {
            val cached = partyDao.getPartyById(partyId)
            if (cached != null) {
                emit(Result.Success(cached.toDomain()))
            } else {
                emit(Result.Error(e.localizedMessage ?: "Network error"))
            }
        }
    }

    override fun getCandidates(
        page: Int,
        partyId: String?,
        officeId: String?,
        stateId: String?
    ): Flow<Result<List<Candidate>>> = flow {
        emit(Result.Loading)
        try {
            val response = politicsApi.getCandidates(page, 20, partyId, officeId, stateId)
            if (response.isSuccessful) {
                val candidates = response.body()?.data?.map { it.toDomain() } ?: emptyList()
                emit(Result.Success(candidates))
            } else {
                emit(Result.Error(response.message() ?: "Failed to load candidates"))
            }
        } catch (e: Exception) {
            emit(Result.Error(e.localizedMessage ?: "Network error"))
        }
    }

    override fun getCandidate(candidateId: String): Flow<Result<Candidate>> = flow {
        emit(Result.Loading)
        try {
            val response = politicsApi.getCandidate(candidateId)
            if (response.isSuccessful) {
                val candidate = response.body()?.data?.toDomain()
                if (candidate != null) {
                    emit(Result.Success(candidate))
                } else {
                    emit(Result.Error("Candidate not found"))
                }
            } else {
                emit(Result.Error(response.message() ?: "Failed to load candidate"))
            }
        } catch (e: Exception) {
            emit(Result.Error(e.localizedMessage ?: "Network error"))
        }
    }

    override fun getOffices(): Flow<Result<List<Office>>> = flow {
        emit(Result.Loading)
        try {
            val response = politicsApi.getOffices()
            if (response.isSuccessful) {
                val offices = response.body()?.data?.map { it.toDomain() } ?: emptyList()
                emit(Result.Success(offices))
            } else {
                emit(Result.Error(response.message() ?: "Failed to load offices"))
            }
        } catch (e: Exception) {
            emit(Result.Error(e.localizedMessage ?: "Network error"))
        }
    }

    override fun getElections(status: String?, stateId: String?): Flow<Result<List<Election>>> = flow {
        emit(Result.Loading)
        try {
            val response = politicsApi.getElections(status, stateId)
            if (response.isSuccessful) {
                val elections = response.body()?.data?.map { it.toDomain() } ?: emptyList()
                emit(Result.Success(elections))
            } else {
                emit(Result.Error(response.message() ?: "Failed to load elections"))
            }
        } catch (e: Exception) {
            emit(Result.Error(e.localizedMessage ?: "Network error"))
        }
    }

    override fun getElection(electionId: String): Flow<Result<Election>> = flow {
        emit(Result.Loading)
        try {
            val response = politicsApi.getElection(electionId)
            if (response.isSuccessful) {
                val election = response.body()?.data?.toDomain()
                if (election != null) {
                    emit(Result.Success(election))
                } else {
                    emit(Result.Error("Election not found"))
                }
            } else {
                emit(Result.Error(response.message() ?: "Failed to load election"))
            }
        } catch (e: Exception) {
            emit(Result.Error(e.localizedMessage ?: "Network error"))
        }
    }

    // --- Mapping ---

    private fun com.ninejatruth.app.data.remote.dto.PartyDto.toDomain() = Party(
        id = id,
        name = name,
        acronym = acronym,
        logoUrl = logoUrl,
        color = color,
        foundedYear = foundedYear,
        ideology = ideology,
        motto = motto,
        chairman = chairman,
        headquarters = headquarters,
        website = website,
        truthScore = truthScore,
        memberCount = memberCount
    )

    private fun com.ninejatruth.app.data.remote.dto.CandidateDto.toDomain() = Candidate(
        id = id,
        fullName = fullName,
        partyId = partyId,
        partyName = partyName,
        partyAcronym = partyAcronym,
        partyLogoUrl = partyLogoUrl,
        officeId = officeId,
        officeName = officeName,
        stateId = stateId,
        stateName = stateName,
        photoUrl = photoUrl,
        bio = bio,
        education = education,
        experience = experience,
        promises = promises,
        truthScore = truthScore,
        verified = verified
    )

    private fun com.ninejatruth.app.data.remote.dto.OfficeDto.toDomain() = Office(
        id = id,
        title = title,
        level = level,
        description = description,
        termLength = termLength,
        termLimit = termLimit
    )

    private fun com.ninejatruth.app.data.remote.dto.ElectionDto.toDomain() = Election(
        id = id,
        title = title,
        type = type,
        officeId = officeId,
        officeName = officeName,
        stateId = stateId,
        stateName = stateName,
        date = date,
        status = status,
        registrationDeadline = registrationDeadline,
        description = description,
        totalVotes = totalVotes,
        turnout = turnout
    )

    private fun Party.toEntity() = PartyEntity(
        id = id,
        name = name,
        acronym = acronym,
        logoUrl = logoUrl,
        color = color,
        foundedYear = foundedYear,
        ideology = ideology,
        chairman = chairman,
        headquarters = headquarters,
        truthScore = truthScore
    )

    private fun PartyEntity.toDomain() = Party(
        id = id,
        name = name,
        acronym = acronym,
        logoUrl = logoUrl,
        color = color,
        foundedYear = foundedYear,
        ideology = ideology,
        chairman = chairman,
        headquarters = headquarters,
        website = null,
        motto = null,
        truthScore = truthScore,
        memberCount = null
    )
}
