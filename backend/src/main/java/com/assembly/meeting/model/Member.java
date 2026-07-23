package com.assembly.meeting.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "members")
public class Member {

    @Id
    private String id;
    private String name;
    private String role;
    private String avatarSymbol;

    // Constructors
    public Member() {}

    public Member(String id, String name, String role, String avatarSymbol) {
        this.id = id;
        this.name = name;
        this.role = role;
        this.avatarSymbol = avatarSymbol;
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getAvatarSymbol() {
        return avatarSymbol;
    }

    public void setAvatarSymbol(String avatarSymbol) {
        this.avatarSymbol = avatarSymbol;
    }
}
