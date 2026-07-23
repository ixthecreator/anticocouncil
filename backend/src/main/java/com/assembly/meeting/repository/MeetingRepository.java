package com.assembly.meeting.repository;

import com.assembly.meeting.model.Meeting;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MeetingRepository extends JpaRepository<Meeting, String> {
    List<Meeting> findAllByOrderByCreatedAtAsc();
}
